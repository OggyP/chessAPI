"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.verifyToken = verifyToken;
exports.register = register;
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = require("../database");
const mysql_1 = __importDefault(require("mysql"));
const crypto_1 = require("crypto");
const passwordSaltRounds = 10;
function checkTokenHasNotExpired(tokenToCheck) {
    const [token, createdAt] = tokenToCheck.split('|');
    const dateCreated = new Date(Number(createdAt));
    let expiresDate = new Date();
    expiresDate.setDate(dateCreated.getDate() + 30);
    if (new Date() < expiresDate) {
        return true;
    }
    return false;
}
async function verifyToken(userId, tokenToCheck) {
    const selectUser = await (0, database_1.sqlQuery)("SELECT * FROM users WHERE userId = " + mysql_1.default.escape(userId));
    if (selectUser.error)
        throw selectUser.error;
    const result = selectUser.result;
    if (result.length === 1) {
        const tokens = JSON.parse(result[0].tokens);
        const remainingTokens = tokens.filter(checkTokenHasNotExpired);
        if (remainingTokens.length !== tokens.length) {
            const sql = "UPDATE users SET tokens = " + mysql_1.default.escape(JSON.stringify(remainingTokens)) + " WHERE UserId = " + mysql_1.default.escape(userId);
            (0, database_1.sqlQuery)(sql);
        }
        for (let i = 0; i < remainingTokens.length; i++) {
            const [token, createdAt] = remainingTokens[i].split('|');
            if (token === tokenToCheck) {
                result[0].passwordHash = undefined;
                result[0].tokens = undefined;
                return result[0];
            }
        }
        return false;
    }
    else {
        return false;
    }
}
async function login(user, pwd) {
    const info = await (0, database_1.sqlQuery)("SELECT * FROM users WHERE username = " + mysql_1.default.escape(user));
    if (info.error)
        throw info;
    const result = info.result;
    if (result.length === 1) {
        const response = await bcrypt_1.default.compare(pwd, result[0].passwordHash);
        if (response) {
            console.log(result[0].username + " logged in.");
            const userId = result[0].userId;
            const token = (0, crypto_1.randomUUID)();
            let tokenList = JSON.parse(result[0].tokens);
            tokenList.push(token + '|' + (new Date()).getTime());
            const sql = "UPDATE users SET tokens = " + mysql_1.default.escape(JSON.stringify(tokenList)) + " WHERE UserId = " + mysql_1.default.escape(userId);
            (0, database_1.sqlQuery)(sql);
            result[0].passwordHash = undefined;
            result[0].tokens = undefined;
            return {
                valid: true,
                user: result[0],
                token: token
            };
        }
        else
            return {
                valid: false,
                info: 'Invalid Password'
            };
    }
    else
        return {
            valid: false,
            info: 'Invalid Username'
        };
}
const usernameRegex = new RegExp("^[0-9A-Za-z _.-]+$");
async function register(username, password) {
    try {
        if (username.length >= 20 || !usernameRegex.test(username)) {
            return {
                valid: false,
                info: "Username must be less than 20 characters and you can only use -_ and space special characters."
            };
        }
        const info = await (0, database_1.sqlQuery)("SELECT * FROM users WHERE username = " + mysql_1.default.escape(username));
        if (info.error)
            throw info;
        const rows = info.result;
        if (rows.length > 0) {
            return {
                valid: false,
                info: "That username has already been registered."
            };
        }
        const hash = await bcrypt_1.default.hash(password, passwordSaltRounds);
        const sql = "INSERT INTO users (username, passwordHash) VALUES (" + mysql_1.default.escape(username) + ", " + mysql_1.default.escape(hash) + ")";
        const creationInfo = await (0, database_1.sqlQuery)(sql);
        if (creationInfo.error)
            throw creationInfo;
        return {
            valid: true,
            info: "User Created! You can now login."
        };
    }
    catch (err) {
        throw err;
    }
}
//# sourceMappingURL=auth.js.map