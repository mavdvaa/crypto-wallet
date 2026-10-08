import express from "express"
import { checkCryptoDB } from "./dbWallet.js"
import { requireApiKey } from "./APIKey.js"
import { listOfPrices } from "./dbPrice.js"


const routerPrice = express.Router()

export default routerPrice

routerPrice.get('/priceStory', requireApiKey, async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { crypto, length } = body

    const symbol = typeof crypto === 'string' ? crypto.trim().toUpperCase() : ''

    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
        return res.status(400).json({message: "Введите название монеты"})
    }

    if (!Number.isInteger(length) || length < 1 || length > 1000) {
        return res.status(400).json({message: "Длина списка должна быть целым числом от 1 до 1000"})
    }

    try {
        const checkExists = await checkCryptoDB(req.user.id, symbol)
        if (!checkExists) {
            return res.status(400).json({message: "У вас в кошельке нет монеты с таким название"})
        }
    }
    catch (err) {
        console.error('Ошибка при проверке монеты в кошельке:', err.message)
        return res.status(500).json({ message: 'Не удалось проверить данные' })
    }

    try {
        const list = await listOfPrices(symbol, length)
        return res.status(200).json({list})
    }
    catch (err) {
        console.error('Ошибка при получении истории цен:', err.message)
        return res.status(500).json({ message: 'Не удалось загрузить данные' })
    }

})