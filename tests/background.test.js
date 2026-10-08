import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const testDirectory = mkdtempSync(path.join(os.tmpdir(), 'crypto-background-tests-'))
process.env.DB_PATH = path.join(testDirectory, 'test.db')
process.env.CMC_API_KEY = 'test-cmc-key'

const originalAxiosGet = axios.get
let db
let addNewCrypto
let priceUpdate
let startPriceUpdates
let stopPriceUpdates

function response(body, status = 200) {
    return {
        status,
        data: body
    }
}

function quoteResponse() {
    return response({
        status: { error_code: 0 },
        data: {
            BTC: {
                name: 'Bitcoin',
                quote: { USD: { price: 123.45 } }
            }
        }
    })
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, err => err ? reject(err) : resolve())
    })
}

function all(sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => err ? reject(err) : resolve(rows))
    })
}

beforeAll(async () => {
    ({ default: db } = await import('../src/db.js'))
    ;({ addNewCrypto } = await import('../src/dbPrice.js'))
    ;({ priceUpdate, startPriceUpdates, stopPriceUpdates } = await import('../src/binanceCheck.js'))
})

beforeEach(async () => {
    jest.useRealTimers()
    axios.get = jest.fn(async () => quoteResponse())
    await run('DELETE FROM prices')
    await run('DELETE FROM wallet')
    await run('DELETE FROM users')
    await run(
        'INSERT INTO users (username, password, token) VALUES (?, ?, ?)',
        ['background-test', 'hash', 'token']
    )
    await addNewCrypto(1, 'BTC', 'Bitcoin')
})

afterAll(async () => {
    jest.useRealTimers()
    axios.get = originalAxiosGet
    await stopPriceUpdates()
    if (db) {
        await new Promise((resolve, reject) => {
            db.close(err => err ? reject(err) : resolve())
        })
    }
    rmSync(testDirectory, { recursive: true, force: true })
})

describe('price background task', () => {
    test('fetches and stores the latest price for tracked coins', async () => {
        await priceUpdate()

        const prices = await all('SELECT crypto, price FROM prices')
        const wallet = await all('SELECT name, updated_at FROM wallet WHERE crypto = \'BTC\'')

        expect(prices).toEqual([expect.objectContaining({ crypto: 'BTC', price: 123.45 })])
        expect(wallet[0].name).toBe('Bitcoin')
        expect(wallet[0].updated_at).toBeTruthy()
    })

    test('handles CoinMarketCap errors without failing the task', async () => {
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})
        axios.get = jest.fn(async () => {
            const error = new Error('CoinMarketCap unavailable')
            error.response = { status: 503 }
            throw error
        })

        await expect(priceUpdate()).resolves.toBeUndefined()
        expect(errorLog).toHaveBeenCalledWith(
            'Ошибка при добавлении цены для BTC:',
            expect.stringContaining('HTTP 503')
        )
        expect(await all('SELECT crypto FROM prices')).toEqual([])

        errorLog.mockRestore()
    })

    test('runs automatically and stops cleanly', async () => {
        jest.useFakeTimers()

        startPriceUpdates()
        await jest.advanceTimersByTimeAsync(60000)
        await stopPriceUpdates()

        expect(axios.get).toHaveBeenCalledTimes(1)
        expect(await all('SELECT crypto FROM prices')).toHaveLength(1)
        jest.useRealTimers()
    })
})
