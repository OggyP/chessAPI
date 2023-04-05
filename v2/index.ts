import express from 'express'
import account from './account'
import games from './games'
import user from './user'

let router = express.Router()

router.use('/account', account)
router.use('/games', games)
router.use('/user', user)

export default router