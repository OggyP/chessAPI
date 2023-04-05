import express from 'express'
import { login, register, verifyToken } from './auth'
import { games, playersInGame } from '../websocket/play'
let router = express.Router()

router.post('/login', async (req, res) => {
    if (!(req.body.username && req.body.password))
        res.status(400).send("Username and/or Password missing.")
    const info = await login(req.body.username, req.body.password)
    if (info.valid)
        res.send({ token: info.token, user: info.user })
    else
        res.status(401).send(info.info)
})

router.post('/register', async (req, res) => {
    if (!(req.body.username && req.body.password))
        res.status(400).send("Username and/or Password missing.")
    const info = await register(req.body.username, req.body.password)
    if (info.valid)
        res.send({ info: info.info })
    else
        res.status(401).send(info.info)
})

router.get('/status', async (req, res) => {
    if (!(req.headers.token && req.headers['user-id'])) {
        res.status(400).send("User ID and/or token missing.")
        return
    }
    const info = await verifyToken(req.headers['user-id'] as string, req.headers.token as string)
    if (info) {
        if (playersInGame.has(info.userId)) {
            const gameId = playersInGame.get(info.userId)
            if (gameId) {
                const game = games.get(gameId)
                if (game) {
                    res.send({
                        redirect: `/play/${game.gameInfo.mode}/${game.gameInfo.time.base}+${game.gameInfo.time.increment}`
                    })
                    return
                }
            }
        }
        res.status(204)
    }
    else
        res.status(401).send("Invalid User ID / token.")
})

router.post('/token', async (req, res) => {
    if (!(req.body.userId && req.body.token)) {
        res.status(400).send("User ID and/or token missing.")
        return
    }
    const info = await verifyToken(req.body.userId, req.body.token)
    if (info)
        res.send(info)
    else
        res.status(401).send("Invalid User ID / token.")
})

export default router
