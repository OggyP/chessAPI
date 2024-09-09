"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queues = exports.gameModes = void 0;
exports.joinQueue = joinQueue;
exports.broadcastQueues = broadcastQueues;
const clients_1 = require("./clients");
const play_1 = require("./play");
Object.defineProperty(exports, "gameModes", { enumerable: true, get: function () { return play_1.gameModes; } });
const queues = new Map();
exports.queues = queues;
function broadcastQueues() {
    const dataToSend = Array.from(queues, ([key, queueInfo]) => ({ gameInfo: queueInfo.gameInfo, player: queueInfo.user.info }));
    clients_1.homeActiveConnections.forEach((ws) => (0, clients_1.sendToWs)(ws, 'queues', dataToSend));
}
function joinQueue(ws, gameInfo) {
    const clientInfo = ws.clientInfo;
    const queueName = JSON.stringify(gameInfo);
    if (queues.has(queueName)) {
        // Queue already exists
        const queue = queues.get(queueName);
        if (Math.random() <= 0.5)
            (0, play_1.createGame)(gameInfo, {
                white: {
                    info: queue.user.info,
                    ws: queue.user.ws
                },
                black: {
                    info: clientInfo,
                    ws: ws
                }
            });
        else
            (0, play_1.createGame)(gameInfo, {
                black: {
                    info: queue.user.info,
                    ws: queue.user.ws
                },
                white: {
                    info: clientInfo,
                    ws: ws
                }
            });
        queues.delete(queueName);
        broadcastQueues();
    }
    else {
        // Queue does not already exist
        queues.set(queueName, {
            user: {
                info: clientInfo,
                ws: ws
            },
            gameInfo: gameInfo
        });
        broadcastQueues();
        (0, clients_1.sendToWs)(ws, 'queue', gameInfo);
    }
}
//# sourceMappingURL=queue.js.map