import express from "express"
import { requireApiKey } from "./APIKey.js"
import { checkCrypto, addCrypto } from "./binanceCheck.js"
import { getWallet, updateWallet, deleteCrypto, checkCryptoDB } from "./dbWallet.js"
import { addNewCrypto } from "./dbPrice.js"

const router = express.Router()

router.get('/wallet', requireApiKey, async (req, res) => {

    try {
        const row = await getWallet(req.user.id)
        res.status(200).json({ user: row })
    }
    catch (err) {
        console.error('Ошибка при получении данных пользователя:', err.message)
        return res.status(500).json({ message: 'Не удалось получить данные пользователя' })
    }
})



router.post('/wallet/add', requireApiKey, async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { crypto } = body

    const symbol = typeof crypto === 'string' ? crypto.trim().toUpperCase() : ''

    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
        return res.status(400).json({ message: "Введите название монеты" })
    }

    try {
        const exists = await checkCryptoDB(req.user.id, symbol)
        if (exists) {
            return res.status(409).json({ message: 'Эта монета уже есть в вашем кошельке' })
        }
    } catch (err) {
        console.error('Ошибка при проверке монеты в кошельке:', err.message)
        return res.status(500).json({ message: 'Не удалось проверить кошелёк' })
    }

    try {
        const isKnownCrypto = await checkCrypto(symbol)
        if (!isKnownCrypto) {
            return res.status(404).json({ message: 'Монета с таким символом не найдена в CoinMarketCap' })
        }
    } catch (err) {
        console.error('Ошибка при проверке монеты в CoinMarketCap:', err.message)
        return res.status(502).json({ message: 'Не удалось проверить монету в CoinMarketCap' })
    }

    let quote
    try {
        quote = await addCrypto(symbol)
    } catch (err) {
        console.error('Ошибка при получении или сохранении цены:', err.message)
        return res.status(502).json({ message: 'Не удалось получить цену из CoinMarketCap' })
    }

    try {
        await addNewCrypto(req.user.id, symbol, quote.name)
        return res.status(201).json({
            message: 'Монета добавлена в кошелёк',
            crypto: symbol,
            name: quote.name,
            price: quote.price
        })
    } catch (err) {
        console.error('Ошибка при добавлении монеты в кошелёк:', err.message)
        return res.status(500).json({ message: 'Не удалось добавить монету в кошелёк' })
    }
})


router.put('/wallet/update', requireApiKey, async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { crypto, newCrypto } = body

    const symbol = typeof crypto === 'string' ? crypto.trim().toUpperCase() : ''
    const newSymbol = typeof newCrypto === 'string' ? newCrypto.trim().toUpperCase() : ''

    if (!symbol && !newSymbol) {
        return res.status(400).json({message: "Введите старое и новое название монеты для изменения"})
    }

    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
        return res.status(400).json({message: "Введите старое название монеты"})
    }

    if (!/^[A-Z0-9]{2,20}$/.test(newSymbol)) {
        return res.status(400).json({message: "Введите новое название монеты"})
    }

    let checkName
    try {
        checkName = await checkCrypto(newSymbol)
    } catch (err) {
        console.error('Ошибка при проверке монеты в CoinMarketCap:', err.message)
        return res.status(502).json({ message: 'Не удалось проверить монету в CoinMarketCap' })
    }

    if (!checkName) {
        return res.status(404).json({ message: 'Монета с таким символом не найдена в CoinMarketCap' })
    }

    try {
        const currentCrypto = await checkCryptoDB(req.user.id, symbol)
        if (!currentCrypto) {
            return res.status(404).json({ message: 'У вас нет такой монеты в кошельке' })
        }
    }
    catch (err) {
        console.error('Ошибка при проверке монеты в кошельке:', err.message)
        return res.status(500).json({ message: 'Не удалось проверить данные' })
    }

    try {
        const checkExists = await checkCryptoDB(req.user.id, newSymbol)
        if (checkExists) {
            return res.status(409).json({message: "У вас уже существует монета с таким названием"})
        }
    }
    catch (err) {
        console.error('Ошибка при проверке монеты в кошельке:', err.message)
        return res.status(500).json({ message: 'Не удалось проверить данные' })
    }

    let quote
    try {
        quote = await addCrypto(newSymbol)
    } catch (err) {
        console.error('Ошибка при получении или сохранении цены:', err.message)
        return res.status(502).json({ message: 'Не удалось получить цену из CoinMarketCap' })
    }

    try {
        await updateWallet(newSymbol, symbol, req.user.id, quote.name)
        res.status(200).json({ message: 'Данные успешно обновлены' })
    }
    catch (err) {
        console.error('Ошибка при обновлении данных в кошелёк:', err.message)
        return res.status(500).json({ message: 'Не удалось обновить данные' })
    }
})

router.delete('/wallet/delete', requireApiKey, async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { crypto } = body

    const symbol = typeof crypto === 'string' ? crypto.trim().toUpperCase() : ''

    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
        return res.status(400).json({message: "Введите название монеты"})
    }

     try {
        const checkExists = await checkCryptoDB(req.user.id, symbol)
        if (!checkExists) {
            return res.status(404).json({message: "У вас нет монеты с таким именем"})
        }
    }
    catch (err) {
        console.error('Ошибка при проверке монеты в кошельке:', err.message)
        return res.status(500).json({ message: 'Не удалось проверить данные' })
    }

    try {
        await deleteCrypto(req.user.id, symbol)
        res.status(200).json({ message: 'Данные успешно удалены' })
    }
    catch (err) {
        console.error('Ошибка при удалении данных:', err.message)
        return res.status(500).json({ message: 'Не удалось удалить данные из кошелька' })
    }
})

export default router