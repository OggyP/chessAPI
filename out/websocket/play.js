"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spectatorsInGame = exports.playersInGame = exports.games = exports.gameModes = void 0;
exports.createGame = createGame;
exports.checkRejoin = checkRejoin;
exports.broadcastSpectateGames = broadcastSpectateGames;
exports.rowToChatMessage = rowToChatMessage;
exports.playerUsername = playerUsername;
const chessLogic_1 = require("../chessLogic/chessLogic");
const database_1 = require("../database");
const clients_1 = require("./clients");
const mysql_1 = __importDefault(require("mysql"));
const crypto_1 = require("crypto");
const gameModes = ['standard', '960', 'fourkings'];
exports.gameModes = gameModes;
const CHAT_MAX_LENGTH = 250;
const CHAT_RATE_LIMIT_MS = 500;
const games = new Map();
exports.games = games;
const playersInGame = new Map();
exports.playersInGame = playersInGame;
const spectatorsInGame = new Map();
exports.spectatorsInGame = spectatorsInGame;
function formatPlayerName(info) {
    return ((info.title) ? `${info.title}|` : '') + info.username;
}
function playerUsername(stored) {
    const parts = stored.split('|');
    return parts.length > 1 ? parts.slice(1).join('|') : parts[0];
}
function resolveChatRole(username, isSpectator, whiteName, blackName) {
    if (isSpectator)
        return 'spectator';
    if (username === whiteName || username === playerUsername(whiteName))
        return 'white';
    if (username === blackName || username === playerUsername(blackName))
        return 'black';
    return 'spectator';
}
function rowToChatMessage(row, whiteName, blackName) {
    const isSpectator = !!row.is_spectator;
    const username = row.user || '';
    return {
        id: row.id,
        text: row.message || '',
        user: username,
        isSpectator,
        moveNum: row.move_num,
        role: resolveChatRole(username, isSpectator, whiteName, blackName),
        sentAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
}
function broadcastSpectateGames() {
    const dataToSend = Array.from(games, ([gameId, game]) => ({
        gameId: gameId,
        gameInfo: game.gameInfo,
        players: {
            white: game.players.white.info,
            black: game.players.black.info
        }
    }));
    clients_1.homeActiveConnections.forEach((ws) => (0, clients_1.sendToWs)(ws, 'spectateGames', dataToSend));
}
class Game {
    players;
    gameType;
    game;
    gameInfo;
    timers;
    id;
    sqlGameId;
    spectators;
    chatRateLimit;
    constructor(gameId, gameInfo, players, sqlGameId) {
        this.id = gameId;
        this.sqlGameId = sqlGameId;
        this.players = players;
        this.gameInfo = gameInfo;
        this.gameType = (0, chessLogic_1.getChessGame)(gameInfo.mode);
        this.spectators = [];
        this.chatRateLimit = new Map();
        this.timers = {
            white: { "time": gameInfo.time.base * 1000, "timeout": null, "startedWaiting": new Date().getTime() },
            black: { "time": gameInfo.time.base * 1000, "timeout": null, "startedWaiting": new Date().getTime() }
        };
        const currentDate = new Date();
        const fullChessModeNames = {
            'standard': 'Standard',
            '960': '960',
            'fourkings': 'Four Kings'
        };
        const startingFEN = this.gameType.genBoard();
        console.log(startingFEN);
        const metaValues = new Map([
            ['Event', 'Live Chess'],
            ['Site', 'https://chess.oggyp.com'],
            ['Date', currentDate.getFullYear() + '.' + currentDate.getMonth() + '.' + currentDate.getDate()],
            ['Round', '?'],
            ['White', this.players.white.info.username],
            ['Black', this.players.black.info.username],
            ['WhiteElo', this.players.white.info.rating.toString()],
            ['BlackElo', this.players.black.info.rating.toString()],
            ['Result', '*'],
            ['Variant', fullChessModeNames[gameInfo.mode]],
            ['TimeControl', `${gameInfo.time.base}+${gameInfo.time.increment}`],
            ['ECO', '?'],
            ['Opening', '?'],
            ['FEN', startingFEN]
        ]);
        this.game = new this.gameType({
            fen: {
                val: startingFEN,
                meta: metaValues
            }
        });
        this.sendGameInfo('white');
        this.sendGameInfo('black');
        this.players.white.ws.on('message', (data) => this.receivedMessage('white', data));
        this.players.black.ws.on('message', (data) => this.receivedMessage('black', data));
        const timerInfo = this.updateTimer('white', true);
        (0, clients_1.sendToWs)(this.players.white.ws, "timerUpdate", timerInfo);
        (0, clients_1.sendToWs)(this.players.black.ws, "timerUpdate", timerInfo);
    }
    receivedMessage(team, message) {
        try {
            const event = JSON.parse(message);
            const data = event.data;
            switch (event.type) {
                case 'move':
                    this.performMove(team, data);
                    break;
                case 'game':
                    if (data.option === 'resign') {
                        this.game.setGameOver({
                            by: 'resignation',
                            winner: oppositeTeam(team)
                        });
                        this.onGameOver();
                    }
                    break;
                case 'chat':
                    this.handleChat(this.players[team].info, team, data?.text);
                    break;
            }
        }
        catch (e) {
            (0, clients_1.sendToWs)(this.players[team].ws, 'error', {
                title: "Internal Server Error",
                description: `${e}`
            });
        }
    }
    receivedSpectatorMessage(user, message) {
        try {
            const event = JSON.parse(message);
            if (event.type === 'chat')
                this.handleChat(user, 'spectator', event.data?.text);
        }
        catch (e) {
            // Ignore malformed spectator messages
        }
    }
    async handleChat(from, role, rawText) {
        if (typeof rawText !== 'string')
            return;
        const text = rawText.trim().slice(0, CHAT_MAX_LENGTH);
        if (!text)
            return;
        const now = Date.now();
        const lastSent = this.chatRateLimit.get(from.userId);
        if (lastSent && now - lastSent < CHAT_RATE_LIMIT_MS)
            return;
        this.chatRateLimit.set(from.userId, now);
        const isSpectator = role === 'spectator';
        const moveNum = this.game.getMoveCount();
        const userName = from.username;
        const insertSql = "INSERT INTO messages (game_id, user, is_spectator, message, move_num) VALUES ("
            + mysql_1.default.escape(this.sqlGameId) + ", "
            + mysql_1.default.escape(userName) + ", "
            + mysql_1.default.escape(isSpectator ? 1 : 0) + ", "
            + mysql_1.default.escape(text) + ", "
            + mysql_1.default.escape(moveNum) + ")";
        const response = await (0, database_1.sqlQuery)(insertSql);
        if (response.error) {
            console.error('Failed to save chat message', response.error);
            return;
        }
        const chatMsg = {
            id: response.result.insertId,
            text,
            user: userName,
            isSpectator,
            moveNum,
            role,
            sentAt: now
        };
        this.broadcastChat(chatMsg);
    }
    broadcastChat(chatMsg) {
        // Players never see spectator messages
        if (!chatMsg.isSpectator) {
            for (let i = 0; i < 2; i++) {
                const player = ['white', 'black'][i];
                const ws = this.players[player].ws;
                if (ws)
                    (0, clients_1.sendToWs)(ws, 'chat', chatMsg);
            }
        }
        for (let i = 0; i < this.spectators.length; i++) {
            const ws = this.spectators[i].ws;
            if (ws)
                (0, clients_1.sendToWs)(ws, 'chat', chatMsg);
        }
    }
    async sendChatHistory(ws, includeSpectators) {
        if (!ws)
            return;
        let sql = "SELECT * FROM messages WHERE game_id = " + mysql_1.default.escape(this.sqlGameId);
        if (!includeSpectators)
            sql += " AND is_spectator = 0";
        sql += " ORDER BY id ASC";
        const response = await (0, database_1.sqlQuery)(sql);
        if (response.error) {
            console.error('Failed to load chat history', response.error);
            return;
        }
        const whiteName = this.players.white.info.username;
        const blackName = this.players.black.info.username;
        const messages = (response.result || []).map((row) => rowToChatMessage(row, whiteName, blackName));
        (0, clients_1.sendToWs)(ws, 'chatHistory', messages);
    }
    sendGameInfo(user) {
        const ws = this.players[user].ws;
        if (ws)
            (0, clients_1.sendToWs)(ws, 'game', {
                mode: this.gameInfo.mode,
                time: this.gameInfo.time,
                team: user,
                pgn: this.game.getPGN(),
                white: this.players.white.info,
                black: this.players.black.info
            });
    }
    performMove(user, data) {
        if (this.game.getLatest().board.getTurn('next') !== user) {
            (0, clients_1.sendToWs)(this.players[user].ws, 'error', {
                title: 'Move Validation Error 1',
                description: 'It is not your turn'
            });
            return;
        }
        const moveRes = this.game.doMove({
            x: data.startingPos[0],
            y: data.startingPos[1]
        }, {
            x: data.endingPos[0],
            y: data.endingPos[1]
        }, data.promote);
        if (moveRes !== true) {
            (0, clients_1.sendToWs)(this.players[user].ws, 'error', {
                title: 'Move Validation Error 2',
                description: moveRes
            });
            return;
        }
        let dataToSend = data;
        const timerInfo = this.updateTimer(this.game.getLatest().board.getTurn('next'));
        dataToSend.timer = timerInfo;
        for (let i = 0; i < 2; i++) {
            const player = ['white', 'black'][i];
            const ws = this.players[player].ws;
            if (ws)
                (0, clients_1.sendToWs)(ws, 'move', dataToSend);
        }
        for (let i = 0; i < this.spectators.length; i++) {
            const ws = this.spectators[i].ws;
            if (ws)
                (0, clients_1.sendToWs)(ws, 'move', dataToSend);
        }
        if (this.game.gameOver)
            this.onGameOver();
    }
    async onGameOver() {
        if (!this.game.gameOver)
            throw 'this literally doesn\'t work';
        console.log("GAME OVER", this.game.gameOver);
        if (this.timers.black.timeout)
            clearTimeout(this.timers.black.timeout);
        if (this.timers.white.timeout)
            clearTimeout(this.timers.white.timeout);
        let ratings = {};
        let SQLgameId = this.sqlGameId;
        for (let i = 0; i < 2; i++) {
            const team = ['white', 'black'][i];
            const playerInfo = this.players[team].info;
            const oppPlayerInfo = this.players[oppositeTeam(team)].info;
            ratings[team] = newRating(team, playerInfo.rating, oppPlayerInfo.rating, playerInfo.ratingDeviation, oppPlayerInfo.ratingDeviation, this.game.gameOver.winner);
        }
        if (this.game.getMoveCount() > 0) {
            const sql = "UPDATE gamesV2 SET "
                + "gameMode = " + mysql_1.default.escape(this.gameInfo.mode)
                + ", white = " + mysql_1.default.escape(formatPlayerName(this.players.white.info))
                + ", black = " + mysql_1.default.escape(formatPlayerName(this.players.black.info))
                + ", winner = " + mysql_1.default.escape(this.game.gameOver.winner)
                + ", gameOverReason = " + mysql_1.default.escape(this.game.gameOver.by)
                + ", gameOverInfo = " + mysql_1.default.escape(this.game.gameOver.extraInfo)
                + ", openingName = " + mysql_1.default.escape(this.game.opening.Name)
                + ", openingECO = " + mysql_1.default.escape(this.game.opening.ECO)
                + ", pgn = " + mysql_1.default.escape(this.game.getPGN())
                + ", timeOption = " + mysql_1.default.escape(this.gameInfo.time.base + '+' + this.gameInfo.time.increment)
                + ", whiteRating = " + mysql_1.default.escape(this.players.white.info.rating)
                + ", blackRating = " + mysql_1.default.escape(this.players.black.info.rating)
                + ", whiteRatingChange = " + mysql_1.default.escape(ratings.white.rating - this.players.white.info.rating)
                + ", blackRatingChange = " + mysql_1.default.escape(ratings.black.rating - this.players.black.info.rating)
                + " WHERE id = " + mysql_1.default.escape(this.sqlGameId);
            console.log(sql);
            const response = await (0, database_1.sqlQuery)(sql);
            if (response.error)
                throw response.error;
            for (let i = 0; i < 2; i++) {
                const team = ['white', 'black'][i];
                const initialPlayerInfo = this.players[team].info;
                let NPI = Object.assign({}, initialPlayerInfo); // New Player Info
                NPI.gamesPlayed++;
                if (this.game.gameOver.winner === team)
                    NPI.wins++;
                else if (this.game.gameOver.winner === 'draw')
                    NPI.draws++;
                NPI.rating = ratings[team].rating;
                NPI.ratingDeviation = ratings[team].deviation;
                let gameIdsList = JSON.parse(initialPlayerInfo.gamesPlayedIds);
                gameIdsList.push(SQLgameId);
                const upateUserSQL = "UPDATE users SET "
                    + "gamesPlayed = " + mysql_1.default.escape(NPI.gamesPlayed)
                    + ", draws = " + mysql_1.default.escape(NPI.draws)
                    + ", wins = " + mysql_1.default.escape(NPI.wins)
                    + ", gamesPlayedIds = " + mysql_1.default.escape(JSON.stringify(gameIdsList))
                    + ", rating = " + mysql_1.default.escape(NPI.rating)
                    + ", ratingDeviation = " + mysql_1.default.escape(NPI.ratingDeviation)
                    + " WHERE userId = " + mysql_1.default.escape(NPI.userId);
                database_1.con.query(upateUserSQL, function (err, insert_result) {
                    if (err)
                        throw err;
                });
            }
        }
        else {
            // No moves played — drop provisional game row and any chat
            await (0, database_1.sqlQuery)("DELETE FROM messages WHERE game_id = " + mysql_1.default.escape(this.sqlGameId));
            await (0, database_1.sqlQuery)("DELETE FROM gamesV2 WHERE id = " + mysql_1.default.escape(this.sqlGameId));
            SQLgameId = undefined;
        }
        for (let i = 0; i < 2; i++) {
            const player = ['white', 'black'][i];
            const ws = this.players[player].ws;
            if (ws)
                (0, clients_1.sendToWs)(ws, 'gameOver', {
                    winner: this.game.gameOver.winner,
                    by: this.game.gameOver.by,
                    info: this.game.gameOver.extraInfo,
                    newRating: (this.game.getMoveCount() > 0) ? ratings[player] : 0,
                    gameId: SQLgameId
                });
        }
        for (let i = 0; i < this.spectators.length; i++) {
            const ws = this.spectators[i].ws;
            if (ws)
                (0, clients_1.sendToWs)(ws, 'gameOver', {
                    winner: this.game.gameOver.winner,
                    by: this.game.gameOver.by,
                    info: this.game.gameOver.extraInfo,
                    newRating: 0,
                    gameId: SQLgameId
                });
            spectatorsInGame.delete(this.spectators[i].user.userId);
        }
        games.delete(this.id);
        playersInGame.delete(this.players.white.info.userId);
        playersInGame.delete(this.players.black.info.userId);
        broadcastSpectateGames();
    }
    getTimerInfo(team, isForRejoin = false) {
        return {
            "whiteTimer": {
                "isCountingDown": (team === 'white'),
                "time": this.timers.white.time -
                    ((isForRejoin && team === 'white') ? (new Date().getTime() - this.timers.white.startedWaiting) : 0),
                "timerStartTime": this.timers.white.startedWaiting
            },
            "blackTimer": {
                "isCountingDown": (team === 'black'),
                "time": this.timers.black.time -
                    ((isForRejoin && team === 'black') ? (new Date().getTime() - this.timers.black.startedWaiting) : 0),
                "timerStartTime": this.timers.black.startedWaiting
            }
        };
    }
    updateTimer(team, gameStarted = true) {
        const teamTimer = this.timers[team];
        const oppTeam = oppositeTeam(team);
        const oppTeamTimer = this.timers[oppTeam];
        if (oppTeamTimer.timeout !== null)
            clearTimeout(oppTeamTimer.timeout); // could be null so we check then cancel it
        if (gameStarted)
            oppTeamTimer.time -= ((new Date().getTime()) - oppTeamTimer.startedWaiting) - this.gameInfo.time.increment * 1000;
        teamTimer.startedWaiting = new Date().getTime();
        teamTimer.timeout = setTimeout(() => {
            this.game.setGameOver({
                winner: oppTeam,
                by: 'timeout'
            });
            this.onGameOver();
        }, teamTimer.time);
        return this.getTimerInfo(team);
    }
    playerLeft(team) {
        this.players[team].ws = null;
    }
    playerRejoin(team, ws) {
        this.players[team].ws = ws;
        ws.on('message', (data) => this.receivedMessage(team, data));
        this.sendGameInfo(team);
        (0, clients_1.sendToWs)(this.players[team].ws, "timerUpdate", this.getTimerInfo(this.game.getLatest().board.getTurn('next'), true));
        this.sendChatHistory(ws, false);
    }
    sendSpectatorList() {
        const data = Array.from(this.spectators, (spectator => spectator.user));
        console.log("sending spec", data);
        for (let i = 0; i < 2; i++) {
            const player = ['white', 'black'][i];
            const ws = this.players[player].ws;
            if (ws)
                (0, clients_1.sendToWs)(ws, 'spectators', data);
        }
        for (let i = 0; i < this.spectators.length; i++) {
            const ws = this.spectators[i].ws;
            if (ws)
                (0, clients_1.sendToWs)(ws, 'spectators', data);
        }
    }
    addSpectator(player, ws) {
        spectatorsInGame.set(player.userId, this.id);
        this.spectators.push({
            user: player,
            ws: ws
        });
        ws.on('message', (data) => this.receivedSpectatorMessage(player, data));
        (0, clients_1.sendToWs)(ws, 'game', {
            mode: this.gameInfo.mode,
            time: this.gameInfo.time,
            team: 'none',
            pgn: this.game.getPGN(),
            white: this.players.white.info,
            black: this.players.black.info
        });
        (0, clients_1.sendToWs)(ws, "timerUpdate", this.getTimerInfo(this.game.getLatest().board.getTurn('next'), true));
        this.sendChatHistory(ws, true);
        this.sendSpectatorList();
    }
    removeSpectator(userId) {
        this.spectators = this.spectators.filter(spectator => spectator.user.userId !== userId);
        this.sendSpectatorList();
    }
}
const q = 0.005756462732485115;
function newRating(team, playerRating, opponentRating, playerRD, opponentRD, result) {
    let resultAsNum = {
        white: 1,
        black: 0,
        draw: 0.5
    }[result];
    if (team === 'black')
        resultAsNum = 1 - resultAsNum;
    let opponentGRD = 1 / Math.sqrt(1 + (3 * q * q * opponentRD * opponentRD) / (Math.PI * Math.PI));
    let eThingy = 1 / (1 + 10 ** ((opponentGRD * (playerRating - opponentRating)) / -400));
    let dSquared = 1 / (q * q * opponentGRD * eThingy * (1 - eThingy));
    playerRating = playerRating + (q / ((1 / playerRD ** 2) + (1 / dSquared))) * opponentGRD * (resultAsNum - eThingy);
    playerRD = Math.max(Math.sqrt(1 / ((1 / (playerRD * playerRD)) + (1 / dSquared))), 50);
    return {
        rating: playerRating,
        deviation: playerRD
    };
}
function checkRejoin(userId, location, ws) {
    if (!playersInGame.has(userId))
        return false;
    const gameId = playersInGame.get(userId);
    if (!gameId)
        return false;
    const game = games.get(gameId);
    if (!game)
        return false;
    switch (location) {
        case '/play':
            const team = (game.players.white.info.userId === userId) ? 'white' : 'black';
            game.playerRejoin(team, ws);
            return true;
        case '/home':
            const info = game.gameInfo;
            (0, clients_1.sendToWs)(ws, 'redirect', {
                location: `/play/${info.mode}/${info.time.base}%2B${info.time.increment}`
            });
            return true;
    }
    return false;
}
function oppositeTeam(team) {
    if (team === 'white')
        return 'black';
    else
        return 'white';
}
async function createGame(gameInfo, players) {
    const insertSql = "INSERT INTO gamesV2 (gameMode, white, black, winner, gameOverReason, gameOverInfo, openingName, openingECO, pgn, timeOption, whiteRating, blackRating, whiteRatingChange, blackRatingChange) VALUES ("
        + mysql_1.default.escape(gameInfo.mode) + ", "
        + mysql_1.default.escape(formatPlayerName(players.white.info)) + ", "
        + mysql_1.default.escape(formatPlayerName(players.black.info)) + ", "
        + mysql_1.default.escape('*') + ", "
        + mysql_1.default.escape('ongoing') + ", "
        + mysql_1.default.escape(null) + ", "
        + mysql_1.default.escape('?') + ", "
        + mysql_1.default.escape('?') + ", "
        + mysql_1.default.escape('*') + ", "
        + mysql_1.default.escape(gameInfo.time.base + '+' + gameInfo.time.increment) + ", "
        + mysql_1.default.escape(players.white.info.rating) + ", "
        + mysql_1.default.escape(players.black.info.rating) + ", "
        + mysql_1.default.escape(0) + ", "
        + mysql_1.default.escape(0) + ")";
    const response = await (0, database_1.sqlQuery)(insertSql);
    if (response.error) {
        console.error('Failed to create game', response.error);
        (0, clients_1.sendToWs)(players.white.ws, 'error', {
            title: 'Failed to Start Game',
            description: 'Could not create the game. Please try queueing again.'
        });
        (0, clients_1.sendToWs)(players.black.ws, 'error', {
            title: 'Failed to Start Game',
            description: 'Could not create the game. Please try queueing again.'
        });
        throw response.error;
    }
    const sqlGameId = response.result.insertId;
    const gameId = (0, crypto_1.randomUUID)();
    const game = new Game(gameId, gameInfo, players, sqlGameId);
    games.set(gameId, game);
    playersInGame.set(players.white.info.userId, gameId);
    playersInGame.set(players.black.info.userId, gameId);
    broadcastSpectateGames();
}
//# sourceMappingURL=play.js.map