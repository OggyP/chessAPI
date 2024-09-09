"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.homeActiveConnections = exports.allActiveConnections = void 0;
exports.sendToWs = sendToWs;
exports.purgeClientConnection = purgeClientConnection;
const queue_1 = require("./queue");
const play_1 = require("./play");
function sendToWs(ws, eventType, data) {
    let wsMsg = {
        type: eventType,
        data: {}
    };
    wsMsg.data = data;
    ws.send(JSON.stringify(wsMsg));
}
const allActiveConnections = new Map();
exports.allActiveConnections = allActiveConnections;
const homeActiveConnections = new Map();
exports.homeActiveConnections = homeActiveConnections;
function purgeClientConnection(userId) {
    let updatedQueue = false;
    queue_1.queues.forEach((value, key) => {
        if (value.user.info.userId === userId) {
            updatedQueue = true;
            queue_1.queues.delete(key);
        }
    });
    if (updatedQueue)
        (0, queue_1.broadcastQueues)();
    if (play_1.playersInGame.has(userId)) {
        const gameId = play_1.playersInGame.get(userId);
        if (!gameId)
            return;
        const game = play_1.games.get(gameId);
    }
    if (play_1.spectatorsInGame.has(userId)) {
        const gameId = play_1.spectatorsInGame.get(userId);
        if (!gameId)
            throw new Error('gameId is none');
        const game = play_1.games.get(gameId);
        if (!game)
            throw new Error('game is none');
        game.removeSpectator(userId);
    }
    [allActiveConnections, homeActiveConnections, play_1.spectatorsInGame].forEach(connectionList => {
        connectionList.delete(userId);
    });
}
//# sourceMappingURL=clients.js.map