import { IncomingMessage, createServer } from 'http';
import { WebSocketServer } from 'ws';
import { verifyToken } from './v2/auth';
import { user } from './v2/auth'
import { joinQueue, gameModes, gameOptions, gameModesType, queues } from './websocket/queue';
import { allActiveConnections, homeActiveConnections, purgeClientConnection, sendToWs } from './websocket/clients';
import { checkRejoin } from './websocket/play';

const regex = /\/play\/(?<mode>\w+)\/(?<base>\d+)\+(?<increment>\d+)\//

function authenticate(request: IncomingMessage, next: (arg0: string | undefined, arg1?: user, arg2?: string, arg3?: any) => void) {
    try {
        if (!request.url) {
            next('No url given', undefined)
            return
        }

        // Perform authentication logic here and set client identifier
        const parsedUrl = new URL(request.url, 'http://localhost');

        const token = parsedUrl.searchParams.get('token');
        const userId = parsedUrl.searchParams.get('userId');
        if (!token || !userId) {
            next("URL must contain both 'token' and 'userId' parameters")
            return
        }
        verifyToken(userId, token).then(user => {
            if (!user) {
                next("Incorrect token / userId")
                return
            }

            // Ensure they have not already connected
            if (allActiveConnections.has(user.userId)) {
                console.log(`Client ${user.userId} is already connected`);
                const clientWs = allActiveConnections.get(user.userId)
                sendToWs(clientWs, 'error', {
                    title: "New Logon Location Detected",
                    description: "You have been signed out as you have logged in at a new location"
                })
                purgeClientConnection(user.userId)
                clientWs.deleteFromActiveConnections = false
                clientWs.close()
            }

            if (request.url?.startsWith('/home')) {
                next(undefined, user, '/home', null)
                return
            } else if (request.url?.startsWith('/play')) {
                const match = request.url?.match(regex);

                if (!(match && match.groups)) {
                    next("URL invalid")
                    return
                }

                if (!gameModes.includes(match.groups.mode)) {
                    next("Invalid game mode")
                    return
                }

                const gameInfo: gameOptions = {
                    mode: match.groups.mode as gameModesType,
                    time: {
                        base: parseInt(match.groups.base),
                        increment: parseInt(match.groups.increment)
                    }
                }

                next(undefined, user, '/play', gameInfo)
                return
            }
            next('Invalid url path')
        })
    } catch (err: any) {
        next(err.message)
    }
}

function onSocketError(err: any) {
    console.error(err);
}

function checkConnection(ws: any) {
    const isAlive = ws.readyState === ws.OPEN;
    if (!isAlive) {
        console.log(`Client ${ws.clientId} is not connected`);
        return ws.terminate();
    }
    ws.ping();
}

function runWS() {
    const server = createServer();
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', function connection(ws: any, request: any, client: user, location: string, data: any) {
        ws.on('error', console.error);

        ws.deleteFromActiveConnections = true
        ws.clientId = client.userId;
        ws.clientInfo = client

        allActiveConnections.set(client.userId, ws)

        if (!checkRejoin(client.userId, location, ws)) {
            // Not rejoining a game

            switch (location) {
                case '/play':
                    joinQueue(ws, data)
                    break

                case '/home':
                    homeActiveConnections.set(client.userId, ws)
                    sendToWs(ws, 'queues', Array.from(queues, ([key, queueInfo]) => ({ gameInfo: queueInfo.gameInfo, player: queueInfo.user.info })))
                    break
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

        ws.on('message', function message(data: string) {
            console.log(`Received message ${data} from user ${ws.clientId}`);
        });

        ws.on('close', () => {
            clearInterval(interval);
            console.log(`Client ${ws.clientId} disconnected`);

            if (ws.deleteFromActiveConnections)
                purgeClientConnection(ws.clientId)
        });
    });

    server.on('upgrade', function upgrade(request, socket, head) {
        socket.on('error', onSocketError);

        authenticate(request, function next(err: any, client?: user, location?: string, data?: any) {
            if (err || !client) {
                console.log("Error auth client: " + err)
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
    console.log('WS listening on 8754')
}

export default runWS