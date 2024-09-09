"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mysql_1 = __importDefault(require("mysql"));
const database_1 = require("../database");
let router = express_1.default.Router();
async function getUserInfo(user) {
    let result;
    if (isNaN(user))
        result = await (0, database_1.sqlQuery)("SELECT userId, username, createdAt, wins, draws, gamesPlayed, rating, gamesPlayedIds, ratingDeviation FROM users WHERE username = " + mysql_1.default.escape(user));
    else
        result = await (0, database_1.sqlQuery)("SELECT userId, username, createdAt, wins, draws, gamesPlayed, rating, gamesPlayedIds, ratingDeviation FROM users WHERE userId = " + mysql_1.default.escape(user));
    if (result.result.length > 0)
        return result.result[0];
    else
        return false;
}
router.get('/id/*', async (req, res) => {
    const userId = Number(req.url.slice(4));
    if (isNaN(userId)) {
        res.status(400).send("Invalid Specified User ID");
        return;
    }
    const info = await getUserInfo(userId);
    if (info)
        res.send(info);
    else
        res.status(400).send("Invalid Specified User ID.");
});
router.get('/username/*', async (req, res) => {
    const userId = req.url.slice(10);
    if (!userId) {
        res.status(400).send("Invalid Specified Username");
        return;
    }
    const info = await getUserInfo(userId);
    if (info)
        res.send(info);
    else
        res.status(400).send("Invalid Specified Username.");
});
router.get('/all', async (req, res) => {
    const result = await (0, database_1.sqlQuery)("SELECT userId, username, createdAt, wins, draws, gamesPlayed, rating, gamesPlayedIds, ratingDeviation FROM users");
    res.send(result.result);
});
exports.default = router;
//# sourceMappingURL=user.js.map