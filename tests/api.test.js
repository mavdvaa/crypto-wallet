import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'
import request from 'supertest'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const testDirectory = mkdtempSync(path.join(os.tmpdir(), 'crypto-api-tests-'))
process.env.DB_PATH = path.join(testDirectory, 'test.db')
process.env.CMC_API_KEY = 'test-cmc-key'

const originalAxiosGet = axios.get
let app
let db
let apiKey

function response(body, status = 200) {
    return {
        status,
        data: body
    }
}

function mockCmc() {
    axios.get = jest.fn(async input => {
        const url = new URL(input)
        const symbol = url.searchParams.get('symbol')

        if (url.pathname.endsWith('/cryptocurrency/map')) {
            return response({
                status: { error_code: 0 },
                data: ['BTC', 'ETH', 'SOL'].includes(symbol) ? [{ symbol }] : []
            })
        }

        return response({
            status: { error_code: 0 },
            data: {
                [symbol]: {
                    name: { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana' }[symbol],
                    quote: { USD: { price: 123.45 } }
                }
            }
        })
    })
}

function run(sql, params = []) { 
    return new Promise((resolve, reject) => {
        db.run(sql, params, err => err ? reject(err) : resolve())
    })
}

async function authUser(username = 'tester', password = 'test-password') {
    const result = await request(app)
        .post('/register')
        .send({ username, password })

    return result.body.apiKey
}

beforeAll(async () => {
    ({ default: app } = await import('../src/handler.js'))
    ;({ default: db } = await import('../src/db.js'))
})

beforeEach(async () => {
    mockCmc()
    await run('DELETE FROM prices')
    await run('DELETE FROM wallet')
    await run('DELETE FROM users')
    apiKey = await authUser()
})

afterAll(async () => {
    axios.get = originalAxiosGet
    if (db) {
        await new Promise((resolve, reject) => {
            db.close(err => err ? reject(err) : resolve())
        })
    }
    rmSync(testDirectory, { recursive: true, force: true })
})

describe('auth routes', () => {
    test('register success', async () => {
        const result = await request(app)
            .post('/register')
            .send({ username: 'user2', password: 'pass2' })

        expect(result.status).toBe(201)
        expect(result.body.apiKey).toMatch(/^[a-f0-9]{64}$/)
    })

    test('register bad data', async () => {
        const result = await request(app)
            .post('/register')
            .send({ username: ' ', password: 'pass2' })

        expect(result.status).toBe(400)
    })

    test('auth success', async () => {
        const result = await request(app)
            .post('/auth')
            .send({ username: 'tester', password: 'test-password' })

        expect(result.status).toBe(201)
        expect(result.body.apiKey).toMatch(/^[a-f0-9]{64}$/)
    })

    test('auth bad password', async () => {
        const result = await request(app)
            .post('/auth')
            .send({ username: 'tester', password: 'wrong' })

        expect(result.status).toBe(400)
    })
})

describe('wallet routes', () => {
    test('get wallet works', async () => {
        const result = await request(app)
            .get('/wallet')
            .set('Authorization', `Bearer ${apiKey}`)

        expect(result.status).toBe(200)
        expect(result.body.user).toEqual([])
    })

    test('get wallet without token', async () => {
        const result = await request(app)
            .get('/wallet')

        expect(result.status).toBe(401)
    })

    test('add wallet success', async () => {
        const result = await request(app)
            .post('/wallet/add')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC' })

        expect(result.status).toBe(201)
        expect(result.body).toMatchObject({ crypto: 'BTC', name: 'Bitcoin', price: 123.45 })
    })

    test('add wallet invalid symbol', async () => {
        const result = await request(app)
            .post('/wallet/add')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BITCOIN!' })

        expect(result.status).toBe(400)
    })

    test('update wallet success', async () => {
        await request(app)
            .post('/wallet/add')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC' })

        const result = await request(app)
            .put('/wallet/update')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC', newCrypto: 'ETH' })

        expect(result.status).toBe(200)
    })

    test('update wallet missing coin', async () => {
        const result = await request(app)
            .put('/wallet/update')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC', newCrypto: 'ETH' })

        expect(result.status).toBe(404)
    })

    test('delete wallet success', async () => {
        await request(app)
            .post('/wallet/add')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC' })

        const result = await request(app)
            .delete('/wallet/delete')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC' })

        expect(result.status).toBe(200)
    })

    test('delete wallet not found', async () => {
        const result = await request(app)
            .delete('/wallet/delete')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC' })

        expect(result.status).toBe(404)
    })
})

describe('price history route', () => {
    test('get history success', async () => {
        await request(app)
            .post('/wallet/add')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC' })

        const result = await request(app)
            .get('/priceStory')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC', length: 10 })

        expect(result.status).toBe(200)
        expect(result.body.list[0]).toMatchObject({ crypto: 'BTC', price: 123.45 })
    })

    test('get history bad length', async () => {
        const result = await request(app)
            .get('/priceStory')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC', length: 0 })

        expect(result.status).toBe(400)
    })
})

describe('CoinMarketCap errors', () => {
    test('add wallet if CMC returns 503', async () => {
        axios.get = jest.fn(async () => {
            const error = new Error('CoinMarketCap unavailable')
            error.response = { status: 503 }
            throw error
        })

        const result = await request(app)
            .post('/wallet/add')
            .set('Authorization', `Bearer ${apiKey}`)
            .send({ crypto: 'BTC' })

        expect(result.status).toBe(502)
    })
})
