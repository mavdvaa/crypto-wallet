import 'dotenv/config'
import axios from 'axios'
import { addEntry } from "./dbPrice.js"
import { getWalletCryptos, updateWalletCryptoInfo } from "./dbWallet.js"

export async function checkCrypto(crypto) {

    if (typeof crypto !== 'string' || !/^[A-Z0-9]{2,20}$/.test(crypto)) {
        return false
    }

    if (!process.env.CMC_API_KEY) {
        throw new Error('CMC_API_KEY не задана')
    }

    const url = new URL('https://pro-api.coinmarketcap.com/v1/cryptocurrency/map')
    url.searchParams.set('symbol', crypto)

    try {
        const response = await axios.get(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY
            },
            timeout: 10000
        })

        const result = response.data

        if (result.status?.error_code) {
            throw new Error(`CoinMarketCap API error ${result.status.error_code}: ${result.status.error_message}`)
        }

        return result.data?.some(item => item.symbol === crypto) ?? false
    } catch (err) {
        if (err.response) {
            throw new Error(`CoinMarketCap вернул HTTP ${err.response.status}`)
        }
        throw err
    }
}

export async function addCrypto(crypto) {
    if (!process.env.CMC_API_KEY) {
        throw new Error('CMC_API_KEY не задана')
    }

    const url = new URL('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest')
    url.searchParams.set('symbol', crypto)
    url.searchParams.set('convert', 'USD')

    try {
        const response = await axios.get(url.toString(), {
            headers: {
                'Accept': 'application/json',
                'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY
            },
            timeout: 10000
        })

        const data = response.data

        if (data.status?.error_code) {
            throw new Error(`CoinMarketCap API error ${data.status.error_code}: ${data.status.error_message}`)
        }

        const coin = data.data?.[crypto]
        const name = coin?.name
        const price = coin?.quote?.USD?.price

        if (typeof name !== 'string' || !Number.isFinite(price)) {
            throw new Error(`CoinMarketCap не вернул корректные данные для ${crypto}`)
        }

        await addEntry(crypto, price)
        await updateWalletCryptoInfo(crypto, name)
        return { name, price }
    } catch (err) {
        if (err.response) {
            throw new Error(`CoinMarketCap вернул HTTP ${err.response.status}`)
        }
        throw err
    }
}

export async function priceUpdate() {
    try {
        const rows = await getWalletCryptos()

        if (!rows || rows.length === 0) {
            console.log("Кошелек пуст")
            return
        }

        for (const row of rows) {
            try {
                await addCrypto(row.crypto)
            } catch (err) {
                console.error(`Ошибка при добавлении цены для ${row.crypto}:`, err.message)
            }
        }
    } catch (err) {
        console.error('Ошибка при получении криптовалют из базы данных:', err.message)
    }
}

let priceTimer
let currentUpdate

export function startPriceUpdates() {
    if (priceTimer) return

    priceTimer = setInterval(() => {
        if (currentUpdate) return

        currentUpdate = priceUpdate()
            .catch(err => {
                console.error('Ошибка фонового обновления цен:', err.message)
            })
            .finally(() => {
                currentUpdate = undefined
            })
    }, 60000)
}

export async function stopPriceUpdates() {
    clearInterval(priceTimer)
    priceTimer = undefined

    const update = currentUpdate
    if (update) await update
}
