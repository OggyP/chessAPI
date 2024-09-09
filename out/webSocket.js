"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const ws_1 = require("ws");
const auth_1 = require("./v2/auth");
const queue_1 = require("./websocket/queue");
const clients_1 = require("./websocket/clients");
const play_1 = require("./websocket/play");
const play_2 = require("./websocket/play");
const playRegex = /\/play\/(?<mode>\w+)\/(?<base>\d+)\+(?<increment>\d+)\//;
const spectateRegex = /\/spectate\/(?<game>[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12})/;
function authenticate(request, next) {
    try {
        if (!request.url) {
            next('No url given', undefined);
            return;
        }
        // Perform authentication logic here and set client identifier
        const parsedUrl = new URL(request.url, 'http://localhost');
        const token = parsedUrl.searchParams.get('token');
        const userId = parsedUrl.searchParams.get('userId');
        if (!token || !userId) {
            next("URL must contain both 'token' and 'userId' parameters");
            return;
        }
        (0, auth_1.verifyToken)(userId, token).then(user => {
            if (!user) {
                next("Incorrect token / userId");
                return;
            }
            // Ensure they have not already connected
            if (clients_1.allActiveConnections.has(user.userId)) {
                console.log(`Client ${user.userId} is already connected`);
                const clientWs = clients_1.allActiveConnections.get(user.userId);
                (0, clients_1.sendToWs)(clientWs, 'error', {
                    title: "New Logon Location Detected",
                    description: "You have been signed out as you have logged in at a new location"
                });
                (0, clients_1.purgeClientConnection)(user.userId);
                clientWs.deleteFromActiveConnections = false;
                clientWs.close();
            }
            if (request.url?.startsWith('/home')) {
                next(undefined, user, '/home', null);
                return;
            }
            else if (request.url?.startsWith('/play')) {
                const match = request.url?.match(playRegex);
                if (!(match && match.groups)) {
                    next("URL invalid");
                    return;
                }
                if (!queue_1.gameModes.includes(match.groups.mode)) {
                    next("Invalid game mode");
                    return;
                }
                const gameInfo = {
                    mode: match.groups.mode,
                    time: {
                        base: parseInt(match.groups.base),
                        increment: parseInt(match.groups.increment)
                    }
                };
                next(undefined, user, '/play', gameInfo);
                return;
            }
            else if (request.url?.startsWith('/spectate')) {
                const match = request.url?.match(spectateRegex);
                if (!(match && match.groups)) {
                    next("URL invalid");
                    return;
                }
                if (!play_2.games.has(match.groups.game)) {
                    next("Invalid game id");
                    return;
                }
                next(undefined, user, '/spectate', match.groups.game);
                return;
            }
            next('Invalid url path');
        });
    }
    catch (err) {
        next(err.message);
    }
}
function onSocketError(err) {
    console.error(err);
}
function checkConnection(ws) {
    const isAlive = ws.readyState === ws.OPEN;
    if (!isAlive) {
        console.log(`Client ${ws.clientId} is not connected`);
        return ws.terminate();
    }
    ws.ping();
}
function runWS() {
    const server = (0, http_1.createServer)();
    const wss = new ws_1.WebSocketServer({ noServer: true });
    wss.on('connection', function connection(ws, request, client, location, data) {
        ws.on('error', console.error);
        ws.deleteFromActiveConnections = true;
        ws.clientId = client.userId;
        ws.clientInfo = client;
        clients_1.allActiveConnections.set(client.userId, ws);
        if (!(0, play_1.checkRejoin)(client.userId, location, ws)) {
            // Not rejoining a game
            switch (location) {
                case '/play':
                    (0, queue_1.joinQueue)(ws, data);
                    break;
                case '/home':
                    clients_1.homeActiveConnections.set(client.userId, ws);
                    (0, clients_1.sendToWs)(ws, 'queues', Array.from(queue_1.queues, ([key, queueInfo]) => ({
                        gameInfo: queueInfo.gameInfo,
                        player: queueInfo.user.info
                    })));
                    (0, clients_1.sendToWs)(ws, 'spectateGames', Array.from(play_2.games, ([gameId, game]) => ({
                        gameId: gameId,
                        gameInfo: game.gameInfo,
                        players: {
                            white: game.players.white.info,
                            black: game.players.black.info
                        }
                    })));
                    break;
                case '/spectate':
                    if (!play_2.games.has(data)) {
                        (0, clients_1.sendToWs)(ws, 'error', {
                            title: 'Game Does Not Exist!',
                            description: 'The game you are trying to spectate does not exist'
                        });
                    }
                    const game = play_2.games.get(data);
                    if (!game)
                        throw new Error("Game is undef on spectate");
                    game.addSpectator(client, ws);
            }
        }
        console.log(`Client ${ws.clientId} connected`);
        // Check connection every 2.5 seconds
        const interval = setInterval(() => {
            checkConnection(ws);
        }, 2500);
        ws.on('pong', () => {
            // console.log(`Received pong from client ${ws.clientId}`);
        });
        ws.on('message', function message(data) {
            console.log(`Received message ${data} from user ${ws.clientId}`);
        });
        ws.on('close', () => {
            clearInterval(interval);
            console.log(`Client ${ws.clientId} disconnected`);
            if (ws.deleteFromActiveConnections)
                (0, clients_1.purgeClientConnection)(ws.clientId);
        });
    });
    server.on('upgrade', function upgrade(request, socket, head) {
        socket.on('error', onSocketError);
        authenticate(request, function next(err, client, location, data) {
            if (err || !client) {
                console.log("Error auth client: " + err);
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            socket.removeListener('error', onSocketError);
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request, client, location, data);
            });
        });
    });
    server.listen(8754);
    console.log('WS listening on 8754');
}
exports.default = runWS;
//# sourceMappingURL=webSocket.js.map