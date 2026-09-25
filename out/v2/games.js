"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
const mysql_1 = __importDefault(require("mysql"));
const database_1 = require("../database");
const play_1 = require("../websocket/play");
let router = express_1.default.Router();
async function getGameInfo(gameId) {
    const result = await (0, database_1.sqlQuery)("SELECT * FROM gamesV2 WHERE id = " + mysql_1.default.escape(gameId));
    if (result.result.length > 0) {
        return result.result[0];
    }
    else
        return false;
}
async function getGameMessages(gameId, whiteName, blackName) {
    const result = await (0, database_1.sqlQuery)("SELECT * FROM messages WHERE game_id = " + mysql_1.default.escape(gameId) + " ORDER BY id ASC");
    if (result.error || !result.result)
        return [];
    return result.result.map((row) => (0, play_1.rowToChatMessage)(row, (0, play_1.playerUsername)(whiteName), (0, play_1.playerUsername)(blackName)));
}
router.get('/latest', async (req, res) => {
    if (!(req.headers.token && req.headers['user-id'])) {
        res.status(400).send("User ID and/or token missing.");
        return;
    }
    const info = await (0, auth_1.verifyToken)(req.headers['user-id'], req.headers.token);
    if (info) {
        const sql = "SELECT id, gameMode, white, black, winner, openingName, gameOverReason, openingECO, timeOption FROM gamesV2 WHERE id IN (" + mysql_1.default.escape(JSON.parse(info.gamesPlayedIds)) + ") ORDER BY createdAt DESC LIMIT 100";
        const result = await (0, database_1.sqlQuery)(sql);
        res.send(result.result);
    }
    else
        res.status(401).send("Invalid User ID / token.");
});
router.get('/all', async (req, res) => {
    if (!(req.headers.token && req.headers['user-id'])) {
        res.status(400).send("User ID and/or token missing.");
        return;
    }
    const info = await (0, auth_1.verifyToken)(req.headers['user-id'], req.headers.token);
    if (info) {
        const sql = "SELECT * FROM gamesV2 WHERE id IN (" + mysql_1.default.escape(JSON.parse(info.gamesPlayedIds)) + ") ORDER BY createdAt DESC";
        const result = await (0, database_1.sqlQuery)(sql);
        res.send(result.result);
    }
    else
        res.status(401).send("Invalid User ID / token.");
});
router.get('/everyGameEver', async (req, res) => {
    if (!(req.body.userId && req.body.token))
        res.status(400).send("User ID and/or token missing.");
    if (req.body.userId !== 4)
        res.status(400).send("You aren't oooooulinghui.");
    const info = await (0, auth_1.verifyToken)(req.body.userId, req.body.token);
    if (info) {
        const sql = "SELECT * FROM gamesV2 ORDER BY createdAt DESC";
        const result = await (0, database_1.sqlQuery)(sql);
        res.send(result.result);
    }
    else
        res.status(401).send("Invalid User ID / token.");
});
router.get('/view/:gameId', async (req, res) => {
    const gameId = Number(req.params.gameId);
    if (isNaN(gameId)) {
        res.status(400).send("Invalid game ID");
        return;
    }
    else {
        const gameInfo = await getGameInfo(gameId);
        if (!gameInfo) {
            res.status(400).send("Invalid game ID");
            return;
        }
        if (gameInfo.winner === 'ongoing') {
            res.status(400).send("Game is still in progress");
            return;
        }
        const messages = await getGameMessages(gameId, gameInfo.white, gameInfo.black);
        res.send({ ...gameInfo, messages });
    }
});
exports.default = router;
//# sourceMappingURL=games.js.map