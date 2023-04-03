import GameStandard from '../chessLogic/standard/game'
import GameFisherRandom from '../chessLogic/960/game'
import { ChessBoardType, getChessGame, PieceCodes, Teams, PieceAtPos, convertToChessNotation, Vector } from '../chessLogic/chessLogic'

import { user } from '../v1/auth'
import { sendToWs } from './clients'
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

type gameTypes = typeof GameStandard | typeof GameFisherRandom

class Game {

    players: players
    gameType: gameTypes
    game: GameStandard | GameFisherRandom
    gameInfo: gameOptions
    timers: timers
    id: string

    constructor(gameId: string, gameInfo: gameOptions, players: players) {
        this.id = gameId
        this.players = players
        this.gameInfo = gameInfo
        this.gameType = getChessGame(gameInfo.mode)

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

        console.log(this.game.metaValues)

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

        if (this.game.gameOver)
            this.onGameOver()
    }

    onGameOver() {
        console.log("GAME OVER", this.game.gameOver)

        for (let i = 0; i < 2; i++) {
            const player = ['white', 'black'][i]
            const ws = this.players[player as teams].ws
            if (ws && this.game.gameOver)
                sendToWs(ws, 'gameOver', {
                    winner: this.game.gameOver.winner,
                    by: this.game.gameOver.by,
                    info: this.game.gameOver.extraInfo
                })
        }

        games.delete(this.id)

        playersInGame.delete(this.players.white.info.userId)
        playersInGame.delete(this.players.black.info.userId)
    }

    getTimerInfo(team: teams) { // Team is the team whose turn it is to play a turn now
        return {
            "whiteTimer": {
                "isCountingDown": (team === 'white'),
                "time": this.timers.white.time,
                "timerStartTime": this.timers.white.startedWaiting
            },
            "blackTimer": {
                "isCountingDown": (team === 'black'),
                "time": this.timers.black.time,
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
        sendToWs(this.players[team].ws, "timerUpdate", this.getTimerInfo(this.game.getLatest().board.getTurn('next')))
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
}

export { gameModes, createGame, games, playersInGame, checkRejoin }
export type { gameModesType, gameOptions }