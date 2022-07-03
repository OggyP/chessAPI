import express from 'express'
import { login, register, verifyToken } from './auth'
let router = express.Router()

router.post('/login', async (req, res) => {
    if (!(req.body.username && req.body.password))
        res.status(400).send("Username and/or Password missing.")
    const info = await login(req.body.username, req.body.password)
    if (info.valid)
        res.send({token: info.token, user: info.user})
    else
        res.status(401).send(info.info)
})

router.post('/register', async (req, res) => {
    if (!(req.body.username && req.body.password))
        res.status(400).send("Username and/or Password missing.")
    const info = await register(req.body.username, req.body.password)
    if (info.valid)
        res.send({info: info.info})
    else
        res.status(401).send(info.info)
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
