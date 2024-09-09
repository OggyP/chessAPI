import bcrypt from 'bcrypt'
import mysql from 'mysql'
import { promisify } from 'util'


var con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

con.connect(function (err) {
    if (err) throw err;
    console.log("MYSQL Connected!");
});

const query = promisify(con.query).bind(con);

interface user {
    userId: number,
    username: string,
    passwordHash: string,
    createdAt: Date,
    wins: number,
    draws: number,
    gamesPlayerd: number,
    rating: number,
    gameIds: string,
    ratingDeviation: number,
    token: string,
    tokenTime: Date
}

async function queryToken(userId: number, token: string): Promise<user | false> {
    const result: user[] = await query("SELECT * FROM users WHERE userId = " + mysql.escape(userId) + " AND tokenTime >= curdate() - INTERVAL DAYOFWEEK(curdate())+7 DAY") as user[]
    if (result.length === 1) {
        bcrypt.compare(token, result[0].token, function (error, response) {
            if (error) throw(error)
            if (response)
                return result[0]
            else
                return false
        });
    } else
        throw(Error("Why were there two results???!!!"))
    return false
}

export default queryToken