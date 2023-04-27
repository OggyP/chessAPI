import { user } from '../v2/auth'
import { broadcastQueues, queues } from './queue'
import { games, playersInGame, spectatorsInGame } from './play'

interface wsMsg {
    type: string,
    data: any
}

function sendToWs(ws: WebSocket, eventType: string, data: any) {
    let wsMsg: wsMsg = {
        type: eventType,
        data: {}
    }

    wsMsg.data = data

    ws.send(JSON.stringify(wsMsg))
}

const allActiveConnections: Map<number, any> = new Map()
const homeActiveConnections: Map<number, any> = new Map()

function purgeClientConnection(userId: number) {
    let updatedQueue = false
    queues.forEach((value, key) => {
        if (value.user.info.userId === userId) {
            updatedQueue = true
            queues.delete(key);
        }
    });
    if (updatedQueue)
        broadcastQueues()

    if (playersInGame.has(userId)) {
        const gameId = playersInGame.get(userId)
        if (!gameId) return
        const game = games.get(gameId)
    }

    if (spectatorsInGame.has(userId)) {
        const gameId = spectatorsInGame.get(userId)
        if (!gameId) throw new Error('gameId is none')
        const game = games.get(gameId)
        if (!game) throw new Error('game is none')
        game.removeSpectator(userId)
    }

    [allActiveConnections, homeActiveConnections, spectatorsInGame].forEach(connectionList => {
        connectionList.delete(userId)
    })
}

export { sendToWs, purgeClientConnection, allActiveConnections, homeActiveConnections }