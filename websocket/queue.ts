import { user } from "../v2/auth"
import { homeActiveConnections, sendToWs } from "./clients"
import { gameModes, gameModesType, gameOptions, createGame } from "./play"

interface queueInfo {
    user: {
        info: user,
        ws: any
    }
    gameInfo: gameOptions
}

const queues: Map<string, queueInfo> = new Map()

function broadcastQueues() {
    const dataToSend = Array.from(queues, ([key, queueInfo]) => ({ gameInfo: queueInfo.gameInfo, player: queueInfo.user.info }));
    homeActiveConnections.forEach((ws) => sendToWs(ws, 'queues', dataToSend))
}

function joinQueue(ws: any, gameInfo: gameOptions) {
    const clientInfo = ws.clientInfo
    const queueName = JSON.stringify(gameInfo)

    if (queues.has(queueName)) {
        // Queue already exists
        const queue = queues.get(queueName) as queueInfo

        if (Math.random() <= 0.5)
            createGame(gameInfo, {
                white: {
                    info: queue.user.info,
                    ws: queue.user.ws
                },
                black: {
                    info: clientInfo,
                    ws: ws
                }
            })
        else
            createGame(gameInfo, {
                black: {
                    info: queue.user.info,
                    ws: queue.user.ws
                },
                white: {
                    info: clientInfo,
                    ws: ws
                }
            })

        queues.delete(queueName)
        broadcastQueues()

    } else {
        // Queue does not already exist
        queues.set(queueName, {
            user: {
                info: clientInfo,
                ws: ws
            },
            gameInfo: gameInfo
        })
        broadcastQueues()
        sendToWs(ws, 'queue', gameInfo)
    }

}

export { joinQueue, broadcastQueues, gameModes, queues }
export type { gameOptions, gameModesType }