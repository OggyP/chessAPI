"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const mysql_1 = __importDefault(require("mysql"));
const util_1 = require("util");
var con = mysql_1.default.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});
con.connect(function (err) {
    if (err)
        throw err;
    console.log("MYSQL Connected!");
});
const query = (0, util_1.promisify)(con.query).bind(con);
async function queryToken(userId, token) {
    const result = await query("SELECT * FROM users WHERE userId = " + mysql_1.default.escape(userId) + " AND tokenTime >= curdate() - INTERVAL DAYOFWEEK(curdate())+7 DAY");
    if (result.length === 1) {
        bcrypt_1.default.compare(token, result[0].token, function (error, response) {
            if (error)
                throw (error);
            if (response)
                return result[0];
            else
                return false;
        });
    }
    else
        throw (Error("Why were there two results???!!!"));
    return false;
}
exports.default = queryToken;
//# sourceMappingURL=token.js.map