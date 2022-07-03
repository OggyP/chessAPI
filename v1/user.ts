import express from 'express'
import mysql from 'mysql'
import { sqlQuery } from './database'

let router = express.Router()

async function getUserInfo(user: number | string) {
    let result
    if (isNaN(user as number))
        result = await sqlQuery("SELECT userId, username, createdAt, wins, draws, gamesPlayed, rating, gameIds, ratingDeviation FROM users WHERE username = " + mysql.escape(user))
    else
        result = await sqlQuery("SELECT userId, username, createdAt, wins, draws, gamesPlayed, rating, gameIds, ratingDeviation FROM users WHERE userId = " + mysql.escape(user))
        
    console.log(result)

    if (result.result.length > 0)
        return result.result[0]
    else
        return false
}

router.get('/id/*', async (req, res) => {
    const userId = Number(req.url.slice(4))
    if (isNaN(userId)) {
        res.status(400).send("Invalid Specified User ID")
        return
    }
    const info = await getUserInfo(userId)
    if (info)
        res.send(info)
    else
        res.status(400).send("Invalid Specified User ID.")
})

router.get('/username/*', async (req, res) => {
    const userId = req.url.slice(10)
    if (!userId) {
        res.status(400).send("Invalid Specified Username")
        return
    }
    const info = await getUserInfo(userId)
    if (info)
        res.send(info)
    else
        res.status(400).send("Invalid Specified Username.")
})

router.get('/all', async (req, res) => {
    const result = await sqlQuery("SELECT userId, username, createdAt, wins, draws, gamesPlayed, rating, gameIds, ratingDeviation FROM users")
    res.send(result.result)
})

export default router