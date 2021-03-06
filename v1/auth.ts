import bcrypt from 'bcrypt'
import { con, sqlQuery } from './database'
import mysql from 'mysql'
import { randomUUID } from 'crypto'

const passwordSaltRounds = 10;
const tokenSaltRounds = 8;

interface user {
    userId: number,
    username: string,
    createdAt: Date,
    wins: number,
    draws: number,
    gamesPlayerd: number,
    rating: number,
    gameIds: string,
    ratingDeviation: number,
}

function genToken() {
    return new Promise<{ token: string, hash: string }>(function (resolve) {
        let token = randomUUID()
        console.log(token)
        bcrypt.hash(token, tokenSaltRounds, (err, hash) => {
            resolve({
                token: token,
                hash: hash
            })
        });
    })
}

async function verifyToken(userId: string, token: string) {
    return new Promise<user | false>((resolve) => {
        con.query("SELECT * FROM users WHERE userId = " + mysql.escape(userId) + " AND tokenTime >= curdate() - INTERVAL DAYOFWEEK(curdate())+7 DAY", function (err, result, fields) {
            if (err) throw err;
            if (result.length === 1) {
                bcrypt.compare(token, result[0].token, function (error, response) {
                    if (response) {
                        result[0].passwordHash = undefined
                        result[0].token = undefined
                        result[0].tokenTime = undefined
                        resolve(result[0] as user)
                    } else {
                        resolve(false)
                    }
                });
            } else {
                resolve(false)
            }
        })
    })
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
            const tokenInfo = await genToken()
            const sql = "UPDATE users SET token = " + mysql.escape(tokenInfo.hash) + ", tokenTime = sysdate() WHERE UserId = " + mysql.escape(userId);
            console.log(sql)
            sqlQuery(sql)
            result[0].passwordHash = undefined
            result[0].token = undefined
            result[0].tokenTime = undefined
            return {
                valid: true,
                user: result[0] as user,
                token: tokenInfo.token
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
    if (username.length < 20 && usernameRegex.test(username)) {
        con.query("SELECT * FROM users WHERE username = " + mysql.escape(username), function (err, result, fields) {
            if (err) throw err;
            if (result.length > 0) {
                return {
                    valid: false,
                    info: "That username has already been registered."
                }
            } else {
                bcrypt.hash(password, passwordSaltRounds, (err, hash) => {
                    var sql = "INSERT INTO users (username, passwordHash) VALUES (" + mysql.escape(username) + ", " + mysql.escape(hash) + ")";
                    console.log(sql)
                    con.query(sql, function (err, registerInsertResult) {
                        if (err) throw err;
                        console.log("New user created");
                        return {
                            valid: true,
                            info: "User Created! You can now login."
                        }
                    });
                });
            }
        });
    } else {
        return {
            valid: false,
            info: "Username must be less than 20 characters and you can only use -_ and space special characters."
        }
    }
    return {
        valid: false,
        info: "Unknown Error"
    }
}

export { login, verifyToken, register }