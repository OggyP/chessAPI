import { user } from '../v2/auth'
import { broadcastQueues, queues } from './queue'
import { games, playersInGame } from './play'

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
    [allActiveConnections, homeActiveConnections].forEach(connectionList => {
        connectionList.delete(userId)
    })
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
}

export { sendToWs, purgeClientConnection, allActiveConnections, homeActiveConnections }