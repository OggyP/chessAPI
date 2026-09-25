import express from 'express'
import { verifyToken } from './auth'
import mysql from 'mysql'
import { sqlQuery } from '../database'
import { playerUsername, rowToChatMessage } from '../websocket/play'

let router = express.Router()

async function getGameInfo(gameId: number) {
    const result = await sqlQuery("SELECT * FROM gamesV2 WHERE id = " + mysql.escape(gameId))
    if (result.result.length > 0) {
        return result.result[0]
    } else
        return false
}

async function getGameMessages(gameId: number, whiteName: string, blackName: string) {
    const result = await sqlQuery(
        "SELECT * FROM messages WHERE game_id = " + mysql.escape(gameId) + " ORDER BY id ASC"
    )
    if (result.error || !result.result)
        return []
    return result.result.map((row: any) => rowToChatMessage(row, playerUsername(whiteName), playerUsername(blackName)))
}

router.get('/latest', async (req, res) => {
    if (!(req.headers.token && req.headers['user-id'])) {
        res.status(400).send("User ID and/or token missing.")
        return
    }
    const info = await verifyToken(req.headers['user-id'] as string, req.headers.token as string)
    if (info) {
        const sql = "SELECT id, gameMode, white, black, winner, openingName, gameOverReason, openingECO, timeOption FROM gamesV2 WHERE id IN (" + mysql.escape(JSON.parse(info.gamesPlayedIds)) + ") ORDER BY createdAt DESC LIMIT 100" 
        const result = await sqlQuery(sql)
        res.send(result.result)
    } else
        res.status(401).send("Invalid User ID / token.")
})

router.get('/all', async (req, res) => {
    if (!(req.headers.token && req.headers['user-id'])) {
        res.status(400).send("User ID and/or token missing.")
        return
    }
    const info = await verifyToken(req.headers['user-id'] as string, req.headers.token as string)
    if (info) {
        const sql = "SELECT * FROM gamesV2 WHERE id IN (" + mysql.escape(JSON.parse(info.gamesPlayedIds)) + ") ORDER BY createdAt DESC" 
        const result = await sqlQuery(sql)
        res.send(result.result)
    } else
        res.status(401).send("Invalid User ID / token.")
})

router.get('/everyGameEver', async (req, res) => {
    if (!(req.body.userId && req.body.token))
        res.status(400).send("User ID and/or token missing.")
    if (req.body.userId !== 4)
        res.status(400).send("You aren't oooooulinghui.")
    const info = await verifyToken(req.body.userId, req.body.token)
    if (info) {
        const sql = "SELECT * FROM gamesV2 ORDER BY createdAt DESC" 
        const result = await sqlQuery(sql)
        res.send(result.result)
    } else
        res.status(401).send("Invalid User ID / token.")
})

router.get('/view/*', async (req, res) => {
    const gameId = Number(req.url.slice(6))
    if (isNaN(gameId)) {
        res.status(400).send("Invalid game ID")
        return
    }
    else {
        const gameInfo = await getGameInfo(gameId)
        if (!gameInfo) {
            res.status(400).send("Invalid game ID")
            return
        }
        if (gameInfo.winner === 'ongoing') {
            res.status(400).send("Game is still in progress")
            return
        }
        const messages = await getGameMessages(gameId, gameInfo.white, gameInfo.black)
        res.send({ ...gameInfo, messages })
    }
})

export default router
