import bcrypt from 'bcrypt'
import { con, sqlQuery } from '../database'
import mysql from 'mysql'
import { randomUUID } from 'crypto'

const passwordSaltRounds = 10;

interface user {
    userId: number,
    username: string,
    createdAt: Date,
    wins: number,
    draws: number,
    gamesPlayed: number,
    rating: number,
    lastGameTime: Date,
    gamesPlayedIds: string,
    ratingDeviation: number,
    title?: string,
    ratingChange?: number
}

function checkTokenHasNotExpired(tokenToCheck: string) {
    const [token, createdAt] = tokenToCheck.split('|')
    const dateCreated = new Date(Number(createdAt))
    let expiresDate = new Date()
    expiresDate.setDate(dateCreated.getDate() + 30)
    if (new Date() < expiresDate) {
        return true
    }
    return false
}

async function verifyToken(userId: string, tokenToCheck: string) {
    const selectUser = await sqlQuery("SELECT * FROM users WHERE userId = " + mysql.escape(userId))
    if (selectUser.error) throw selectUser.error
    const result = selectUser.result
    if (result.length === 1) {
        const tokens = JSON.parse(result[0].tokens)
        const remainingTokens = tokens.filter(checkTokenHasNotExpired)
        if (remainingTokens.length !== tokens.length) {
            const sql = "UPDATE users SET tokens = " + mysql.escape(JSON.stringify(remainingTokens)) + " WHERE UserId = " + mysql.escape(userId);
            sqlQuery(sql)
        }
        for (let i = 0; i < remainingTokens.length; i++) {
            const [token, createdAt] = remainingTokens[i].split('|')
            if (token === tokenToCheck) {
                result[0].passwordHash = undefined
                result[0].tokens = undefined
                return (result[0] as user)
            }
        }
        return false
    } else {
        return false
    }
}

async function login(user: string, pwd: string) {
    const info = await sqlQuery("SELECT * FROM users WHERE username = " + mysql.escape(user))
    if (info.error) throw info;
    const result = info.result
    if (result.length === 1) {
        const response = await bcrypt.compare(pwd, result[0].passwordHash)
        if (response) {
            console.log(result[0].username + " logged in.")
            const userId = result[0].userId
            const token = randomUUID()
            let tokenList = JSON.parse(result[0].tokens)
            tokenList.push(token + '|' + (new Date()).getTime())
            const sql = "UPDATE users SET tokens = " + mysql.escape(JSON.stringify(tokenList)) + " WHERE UserId = " + mysql.escape(userId);
            sqlQuery(sql)
            result[0].passwordHash = undefined
            result[0].tokens = undefined
            return {
                valid: true,
                user: result[0] as user,
                token: token
            }
        } else
            return {
                valid: false,
                info: 'Invalid Password'
            }
    } else
        return {
            valid: false,
            info: 'Invalid Username'
        }
}
const usernameRegex = new RegExp("^[0-9A-Za-z _.-]+$");

async function register(username: string, password: string) {
    try {
        if (username.length >= 20 || !usernameRegex.test(username)) {
            return {
                valid: false,
                info: "Username must be less than 20 characters and you can only use -_ and space special characters."
            };
        }

        const info = await sqlQuery("SELECT * FROM users WHERE username = " + mysql.escape(username));
        if (info.error) throw info;
        const rows = info.result
        if (rows.length > 0) {
            return {
                valid: false,
                info: "That username has already been registered."
            };
        }

        const hash = await bcrypt.hash(password, passwordSaltRounds);
        const sql = "INSERT INTO users (username, passwordHash) VALUES (" + mysql.escape(username) + ", " + mysql.escape(hash) + ")";
        const creationInfo = await sqlQuery(sql);
        if (creationInfo.error) throw creationInfo

        return {
            valid: true,
            info: "User Created! You can now login."
        };
    } catch (err) {
        throw err;
    }
}


export { login, verifyToken, register }
export type { user }