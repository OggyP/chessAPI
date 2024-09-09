"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("./auth");
const mysql_1 = __importDefault(require("mysql"));
const database_1 = require("../database");
let router = express_1.default.Router();
async function getGameInfo(gameId) {
    const result = await (0, database_1.sqlQuery)("SELECT * FROM gamesV2 WHERE id = " + mysql_1.default.escape(gameId));
    if (result.result.length > 0) {
        return result.result[0];
    }
    else
        return false;
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
router.get('/view/*', async (req, res) => {
    const gameId = Number(req.url.slice(6));
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
        res.send(gameInfo);
    }
});
exports.default = router;
//# sourceMappingURL=games.js.map