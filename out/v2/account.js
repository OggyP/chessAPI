"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
const play_1 = require("../websocket/play");
let router = express_1.default.Router();
router.post('/login', async (req, res) => {
    if (!(req.body.username && req.body.password))
        res.status(400).send("Username and/or Password missing.");
    const info = await (0, auth_1.login)(req.body.username, req.body.password);
    if (info.valid)
        res.send({ token: info.token, user: info.user });
    else
        res.status(401).send(info.info);
});
router.post('/register', async (req, res) => {
    if (!(req.body.username && req.body.password))
        res.status(400).send("Username and/or Password missing.");
    const info = await (0, auth_1.register)(req.body.username, req.body.password);
    if (info.valid)
        res.send({ info: info.info });
    else
        res.status(401).send(info.info);
});
router.get('/status', async (req, res) => {
    if (!(req.headers.token && req.headers['user-id'])) {
        res.status(400).send("User ID and/or token missing.");
        return;
    }
    const info = await (0, auth_1.verifyToken)(req.headers['user-id'], req.headers.token);
    if (info) {
        if (play_1.playersInGame.has(info.userId)) {
            const gameId = play_1.playersInGame.get(info.userId);
            if (gameId) {
                const game = play_1.games.get(gameId);
                if (game) {
                    res.send({
                        redirect: `/play/${game.gameInfo.mode}/${game.gameInfo.time.base}+${game.gameInfo.time.increment}`
                    });
                    return;
                }
            }
        }
        res.status(204);
    }
    else
        res.status(401).send("Invalid User ID / token.");
});
router.post('/token', async (req, res) => {
    if (!(req.body.userId && req.body.token)) {
        res.status(400).send("User ID and/or token missing.");
        return;
    }
    const info = await (0, auth_1.verifyToken)(req.body.userId, req.body.token);
    if (info)
        res.send(info);
    else
        res.status(401).send("Invalid User ID / token.");
});
exports.default = router;
//# sourceMappingURL=account.js.map