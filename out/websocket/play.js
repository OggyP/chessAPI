"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.spectatorsInGame = exports.playersInGame = exports.games = exports.gameModes = void 0;
exports.createGame = createGame;
exports.checkRejoin = checkRejoin;
exports.broadcastSpectateGames = broadcastSpectateGames;
const chessLogic_1 = require("../chessLogic/chessLogic");
const database_1 = require("../database");
const clients_1 = require("./clients");
const mysql_1 = __importDefault(require("mysql"));
const crypto_1 = require("crypto");
const gameModes = ['standard', '960', 'fourkings'];
exports.gameModes = gameModes;
const games = new Map();
exports.games = games;
const playersInGame = new Map();
exports.playersInGame = playersInGame;
const spectatorsInGame = new Map();
exports.spectatorsInGame = spectatorsInGame;
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
    spectators;
    constructor(gameId, gameInfo, players) {
        this.id = gameId;
        this.players = players;
        this.gameInfo = gameInfo;
        this.gameType = (0, chessLogic_1.getChessGame)(gameInfo.mode);
        this.spectators = [];
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
            }
        }
        catch (e) {
            (0, clients_1.sendToWs)(this.players[team].ws, 'error', {
                title: "Internal Server Error",
                description: `${e}`
            });
        }
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
        let SQLgameId = undefined;
        for (let i = 0; i < 2; i++) {
            const team = ['white', 'black'][i];
            const playerInfo = this.players[team].info;
            const oppPlayerInfo = this.players[oppositeTeam(team)].info;
            ratings[team] = newRating(team, playerInfo.rating, oppPlayerInfo.rating, playerInfo.ratingDeviation, oppPlayerInfo.ratingDeviation, this.game.gameOver.winner);
        }
        if (this.game.getMoveCount() > 0) {
            const sql = "INSERT INTO gamesV2 (gameMode, white, black, winner, gameOverReason, gameOverInfo, openingName, openingECO, pgn, timeOption, whiteRating, blackRating, whiteRatingChange, blackRatingChange) VALUES ("
                + mysql_1.default.escape(this.gameInfo.mode) + ", "
                + mysql_1.default.escape(((this.players.white.info.title) ? `${this.players.white.info.title}|` : '') + this.players.white.info.username) + ", "
                + mysql_1.default.escape(((this.players.black.info.title) ? `${this.players.black.info.title}|` : '') + this.players.black.info.username) + ", "
                + mysql_1.default.escape(this.game.gameOver.winner) + ", "
                + mysql_1.default.escape(this.game.gameOver.by) + ", "
                + mysql_1.default.escape(this.game.gameOver.extraInfo) + ", "
                + mysql_1.default.escape(this.game.opening.Name) + ", "
                + mysql_1.default.escape(this.game.opening.ECO) + ", "
                + mysql_1.default.escape(this.game.getPGN()) + ", "
                + mysql_1.default.escape(this.gameInfo.time.base + '+' + this.gameInfo.time.increment) + ", "
                + mysql_1.default.escape(this.players.white.info.rating) + ", "
                + mysql_1.default.escape(this.players.black.info.rating) + ", "
                + mysql_1.default.escape(ratings.white.rating - this.players.white.info.rating) + ", "
                + mysql_1.default.escape(ratings.black.rating - this.players.black.info.rating) + ")";
            console.log(sql);
            const response = await (0, database_1.sqlQuery)(sql);
            if (response.error)
                throw response.error;
            SQLgameId = response.result.insertId;
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
        (0, clients_1.sendToWs)(ws, 'game', {
            mode: this.gameInfo.mode,
            time: this.gameInfo.time,
            team: 'none',
            pgn: this.game.getPGN(),
            white: this.players.white.info,
            black: this.players.black.info
        });
        (0, clients_1.sendToWs)(ws, "timerUpdate", this.getTimerInfo(this.game.getLatest().board.getTurn('next'), true));
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
                location: `/play/${info.mode}/${info.time.base}+${info.time.increment}`
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
function createGame(gameInfo, players) {
    const gameId = (0, crypto_1.randomUUID)();
    const game = new Game(gameId, gameInfo, players);
    games.set(gameId, game);
    playersInGame.set(players.white.info.userId, gameId);
    playersInGame.set(players.black.info.userId, gameId);
    broadcastSpectateGames();
}
//# sourceMappingURL=play.js.map