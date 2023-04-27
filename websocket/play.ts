import GameStandard from '../chessLogic/standard/game'
import GameFisherRandom from '../chessLogic/960/game'
import { getChessGame, PieceCodes } from '../chessLogic/chessLogic'
import { con, sqlQuery } from '../database'
import { homeActiveConnections, sendToWs } from "./clients"
import mysql from 'mysql'
import { user } from '../v2/auth'

import { randomUUID } from 'crypto'

const gameModes = ['standard', '960']
type gameModesType = 'standard' | '960'
type teams = 'white' | 'black'

interface player {
    info: user
    ws: any | null
}

interface players {
    white: player
    black: player
}

interface timer {
    time: number,
    timeout: any,
    startedWaiting: number
}

interface timers {
    white: timer,
    black: timer
}

interface gameOptions {
    mode: gameModesType,
    time: {
        base: number,
        increment: number
    }
}

interface moveDataReceive {
    startingPos: number[]
    endingPos: number[]
    promote?: PieceCodes
}

interface sendTimerInfo {
    isCountingDown: boolean,
    time: number,
    timerStartTime: number
}

interface moveDataSend extends moveDataReceive {
    timer?: {
        whiteTimer: sendTimerInfo
        blackTimer: sendTimerInfo
    }
}

const games = new Map<string, Game>()
const playersInGame = new Map<number, string>()
const spectatorsInGame = new Map<number, string>()

function broadcastSpectateGames() {
    const dataToSend = Array.from(games, ([gameId, game]) => (
        { 
            gameId: gameId,
            gameInfo: game.gameInfo, 
            players: {
                white: game.players.white.info,
                black: game.players.black.info
            } 
        }
        ));
    homeActiveConnections.forEach((ws) => sendToWs(ws, 'spectateGames', dataToSend))
}

type gameTypes = typeof GameStandard | typeof GameFisherRandom

class Game {

    players: players
    gameType: gameTypes
    game: GameStandard | GameFisherRandom
    gameInfo: gameOptions
    timers: timers
    id: string
    spectators: {
        user: user
        ws: any
    }[]

    constructor(gameId: string, gameInfo: gameOptions, players: players) {
        this.id = gameId
        this.players = players
        this.gameInfo = gameInfo
        this.gameType = getChessGame(gameInfo.mode)

        this.spectators = []

        this.timers = {
            white: { "time": gameInfo.time.base * 1000, "timeout": null, "startedWaiting": new Date().getTime() },
            black: { "time": gameInfo.time.base * 1000, "timeout": null, "startedWaiting": new Date().getTime() }
        }

        const currentDate = new Date()

        const fullChessModeNames = {
            'standard': 'Standard',
            '960': '960'
        }

        const startingFEN: string = this.gameType.genBoard()

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
        ])

        this.game = new this.gameType({
            fen: {
                val: startingFEN,
                meta: metaValues
            }
        })

        this.sendGameInfo('white')
        this.sendGameInfo('black')

        this.players.white.ws.on('message', (data: string) => this.receivedMessage('white', data));
        this.players.black.ws.on('message', (data: string) => this.receivedMessage('black', data));

        const timerInfo = this.updateTimer('white', true)

        sendToWs(this.players.white.ws, "timerUpdate", timerInfo)
        sendToWs(this.players.black.ws, "timerUpdate", timerInfo)
    }

    receivedMessage(team: teams, message: string) {
        try {
            const event = JSON.parse(message)
            const data: any = event.data
            switch (event.type) {
                case 'move':
                    this.performMove(team, data)
                    break;
                case 'game':
                    if (data.option === 'resign') {
                        this.game.setGameOver({
                            by: 'resignation',
                            winner: oppositeTeam(team)
                        })
                        this.onGameOver()
                    }
            }
        } catch (e) {
            sendToWs(this.players[team].ws, 'error', {
                title: "Internal Server Error",
                description: `${e}`
            })
        }
    }

    sendGameInfo(user: teams) {
        const ws = this.players[user].ws
        if (ws)
            sendToWs(ws, 'game', {
                mode: this.gameInfo.mode,
                time: this.gameInfo.time,
                team: user,
                pgn: this.game.getPGN(),
                white: this.players.white.info,
                black: this.players.black.info
            })
    }

    performMove(user: teams, data: moveDataReceive) {
        if (this.game.getLatest().board.getTurn('next') !== user) {
            sendToWs(this.players[user].ws, 'error', {
                title: 'Move Validation Error 1',
                description: 'It is not your turn'
            })
            return
        }

        const moveRes = this.game.doMove({
            x: data.startingPos[0],
            y: data.startingPos[1]
        }, {
            x: data.endingPos[0],
            y: data.endingPos[1]
        },
            data.promote
        )

        if (moveRes !== true) {
            sendToWs(this.players[user].ws, 'error', {
                title: 'Move Validation Error 2',
                description: moveRes
            })
            return
        }

        let dataToSend: moveDataSend = data
        const timerInfo = this.updateTimer(this.game.getLatest().board.getTurn('next'))
        dataToSend.timer = timerInfo

        for (let i = 0; i < 2; i++) {
            const player = ['white', 'black'][i]
            const ws = this.players[player as teams].ws
            if (ws)
                sendToWs(ws, 'move', dataToSend)
        }

        for (let i = 0; i < this.spectators.length; i++) {
            const ws = this.spectators[i].ws
            if (ws)
                sendToWs(ws, 'move', dataToSend)
        }

        if (this.game.gameOver)
            this.onGameOver()
    }

    async onGameOver() {
        if (!this.game.gameOver) throw 'this literally doesn\'t work'
        console.log("GAME OVER", this.game.gameOver)

        if (this.timers.black.timeout) clearTimeout(this.timers.black.timeout)
        if (this.timers.white.timeout) clearTimeout(this.timers.white.timeout)

        let ratings: any = {}
        let SQLgameId: number | undefined = undefined


        for (let i = 0; i < 2; i++) {
            const team: teams = ['white', 'black'][i] as teams
            const playerInfo = this.players[team].info
            const oppPlayerInfo = this.players[oppositeTeam(team)].info

            ratings[team] = newRating(team, playerInfo.rating, oppPlayerInfo.rating, playerInfo.ratingDeviation, oppPlayerInfo.ratingDeviation, this.game.gameOver.winner)
        }

        if (this.game.getMoveCount() > 0) {
            const sql = "INSERT INTO gamesV2 (gameMode, white, black, winner, gameOverReason, gameOverInfo, openingName, openingECO, pgn, timeOption, whiteRating, blackRating, whiteRatingChange, blackRatingChange) VALUES ("
                + mysql.escape(this.gameInfo.mode) + ", "
                + mysql.escape(this.players.white.info.username) + ", "
                + mysql.escape(this.players.black.info.username) + ", "
                + mysql.escape(this.game.gameOver.winner) + ", "
                + mysql.escape(this.game.gameOver.by) + ", "
                + mysql.escape(this.game.gameOver.extraInfo) + ", "
                + mysql.escape(this.game.opening.Name) + ", "
                + mysql.escape(this.game.opening.ECO) + ", "
                + mysql.escape(this.game.getPGN()) + ", "
                + mysql.escape(this.gameInfo.time.base + '+' + this.gameInfo.time.increment) + ", "
                + mysql.escape(this.players.white.info.rating) + ", "
                + mysql.escape(this.players.black.info.rating) + ", "
                + mysql.escape(ratings.white.rating - this.players.white.info.rating) + ", "
                + mysql.escape(ratings.black.rating - this.players.black.info.rating) + ")";
            console.log(sql)
            const response = await sqlQuery(sql)
            if (response.error) throw response.error
            SQLgameId = response.result.insertId

            for (let i = 0; i < 2; i++) {
                const team: teams = ['white', 'black'][i] as teams
                const initialPlayerInfo = this.players[team].info
                let NPI = Object.assign({}, initialPlayerInfo) // New Player Info

                NPI.gamesPlayed++

                if (this.game.gameOver.winner === team)
                    NPI.wins++
                else if (this.game.gameOver.winner === 'draw')
                    NPI.draws++

                NPI.rating = ratings[team].rating
                NPI.ratingDeviation = ratings[team].deviation

                let gameIdsList = JSON.parse(initialPlayerInfo.gamesPlayedIds)
                gameIdsList.push(SQLgameId)

                const upateUserSQL = "UPDATE users SET "
                    + "gamesPlayed = " + mysql.escape(NPI.gamesPlayed)
                    + ", draws = " + mysql.escape(NPI.draws)
                    + ", wins = " + mysql.escape(NPI.wins)
                    + ", gamesPlayedIds = " + mysql.escape(JSON.stringify(gameIdsList))
                    + ", rating = " + mysql.escape(NPI.rating)
                    + ", ratingDeviation = " + mysql.escape(NPI.ratingDeviation)
                    + " WHERE userId = " + mysql.escape(NPI.userId)
                con.query(upateUserSQL, function (err, insert_result) {
                    if (err) throw err;
                });
            }
        }

        for (let i = 0; i < 2; i++) {
            const player = ['white', 'black'][i]
            const ws = this.players[player as teams].ws
            if (ws && this.game.gameOver)
                sendToWs(ws, 'gameOver', {
                    winner: this.game.gameOver.winner,
                    by: this.game.gameOver.by,
                    info: this.game.gameOver.extraInfo,
                    newRating: (this.game.getMoveCount() > 0) ? ratings[player] : 0,
                    gameId: SQLgameId
                })
        }

        for (let i = 0; i < this.spectators.length; i++) {
            const ws = this.spectators[i].ws
            if (ws)
            sendToWs(ws, 'gameOver', {
                winner: this.game.gameOver.winner,
                by: this.game.gameOver.by,
                info: this.game.gameOver.extraInfo,
                newRating: 0,
                gameId: SQLgameId
            })
        }

        games.delete(this.id)

        playersInGame.delete(this.players.white.info.userId)
        playersInGame.delete(this.players.black.info.userId)

        broadcastSpectateGames()
    }

    getTimerInfo(team: teams, isForRejoin: boolean = false) { // Team is the team whose turn it is to play a turn now
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
        }
    }

    updateTimer(team: teams, gameStarted = true) { // Team is the team whose turn it is to play a turn now
        const teamTimer = this.timers[team]
        const oppTeam = oppositeTeam(team)
        const oppTeamTimer = this.timers[oppTeam]

        if (oppTeamTimer.timeout !== null) clearTimeout(oppTeamTimer.timeout); // could be null so we check then cancel it
        if (gameStarted)
            oppTeamTimer.time -= ((new Date().getTime()) - oppTeamTimer.startedWaiting) - this.gameInfo.time.increment * 1000
        teamTimer.startedWaiting = new Date().getTime()
        teamTimer.timeout = setTimeout(() => {
            this.game.setGameOver({
                winner: oppTeam,
                by: 'timeout'
            })
            this.onGameOver()
        }, teamTimer.time)

        return this.getTimerInfo(team)
    }

    playerLeft(team: teams) {
        this.players[team].ws = null
    }

    playerRejoin(team: teams, ws: any) {
        this.players[team].ws = ws
        ws.on('message', (data: string) => this.receivedMessage(team, data));

        this.sendGameInfo(team)
        sendToWs(this.players[team].ws, "timerUpdate", this.getTimerInfo(this.game.getLatest().board.getTurn('next'), true))
    }

    addSpectator(player: user, ws: any) {
        spectatorsInGame.set(player.userId, this.id)
        this.spectators.push({
            user: player,
            ws: ws
        })

        sendToWs(ws, 'game', {
            mode: this.gameInfo.mode,
            time: this.gameInfo.time,
            team: 'none',
            pgn: this.game.getPGN(),
            white: this.players.white.info,
            black: this.players.black.info
        })
        sendToWs(ws, "timerUpdate", this.getTimerInfo(this.game.getLatest().board.getTurn('next'), true))
    }

    removeSpectator(userId: number) {
        this.spectators = this.spectators.filter(spectator => spectator.user.userId !== userId)
    }
}

const q = 0.005756462732485115;

function newRating(team: teams, playerRating: number, opponentRating: number, playerRD: number, opponentRD: number, result: teams | 'draw') {
    let resultAsNum = {
        white: 1,
        black: 0,
        draw: 0.5
    }[result]
    if (team === 'black')
        resultAsNum = 1 - resultAsNum

    let opponentGRD = 1 / Math.sqrt(1 + (3 * q * q * opponentRD * opponentRD) / (Math.PI * Math.PI));
    let eThingy = 1 / (1 + 10 ** ((opponentGRD * (playerRating - opponentRating)) / -400));
    let dSquared = 1 / (q * q * opponentGRD * eThingy * (1 - eThingy));
    playerRating = playerRating + (q / ((1 / playerRD ** 2) + (1 / dSquared))) * opponentGRD * (resultAsNum - eThingy);
    playerRD = Math.max(Math.sqrt(1 / ((1 / (playerRD * playerRD)) + (1 / dSquared))), 50);

    return {
        rating: playerRating,
        deviation: playerRD
    }
}

function checkRejoin(userId: number, location: string, ws: any): boolean {
    if (!playersInGame.has(userId)) return false

    const gameId = playersInGame.get(userId)
    if (!gameId) return false

    const game = games.get(gameId)
    if (!game) return false

    switch (location) {
        case '/play':
            const team = (game.players.white.info.userId === userId) ? 'white' : 'black'
            game.playerRejoin(team, ws)
            return true
        case '/home':
            const info = game.gameInfo
            sendToWs(ws, 'redirect', {
                location: `/play/${info.mode}/${info.time.base}+${info.time.increment}`
            })
            return true
    }
    return false
}

function oppositeTeam(team: teams): teams {
    if (team === 'white')
        return 'black'
    else
        return 'white'
}

function createGame(gameInfo: gameOptions, players: players) {
    const gameId = randomUUID()
    const game = new Game(gameId, gameInfo, players)
    games.set(gameId, game)

    playersInGame.set(players.white.info.userId, gameId)
    playersInGame.set(players.black.info.userId, gameId)

    broadcastSpectateGames()
}

export { gameModes, createGame, games, playersInGame, checkRejoin, broadcastSpectateGames, spectatorsInGame }
export type { gameModesType, gameOptions }