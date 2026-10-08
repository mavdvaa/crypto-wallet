import express from 'express'
import { randomBytes, createHash } from 'node:crypto'
import router from './walletAPI.js'
import routerPrice from './pricesAPI.js'
import { startPriceUpdates } from './binanceCheck.js'
import { setupShutdown } from './shuttingDown.js'
import bcrypt from 'bcrypt'
import { addUser, checkUser, newToken } from './dbHandler.js'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import 'dotenv/config'

export const app = express();
const port = Number(process.env.PORT || 3000);
app.use(express.json())
app.use(router)
app.use(routerPrice)

app.post('/register', async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { username, password } = body

    if (typeof username !== 'string' && typeof password !== 'string') {
        return res.status(400).json({ message: 'Нужно указать имя пользователя и пароль' });
    }
    if (typeof username !== 'string') {
        return res.status(400).json({ message: 'Вы не указали имя пользователя' });
    }
    if (typeof password !== 'string') {
        return res.status(400).json({ message: 'Вы не ввели пароль' });
    }

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
        return res.status(400).json({ message: 'Имя пользователя и пароль не должны быть пустыми' })
    }

    const apiKey = randomBytes(32).toString('hex')
    const hashedApiKey = createHash('sha256').update(apiKey).digest('hex')

    try {
        const salt = 10
        const hashedPassword = await bcrypt.hash(password, salt)

        const isUser = await checkUser(normalizedUsername)

        if (isUser) {
            return res.status(409).json({message: "Пользователь с таким именем уже существует"})
        }

        await addUser(normalizedUsername, hashedPassword, hashedApiKey)
        return res.status(201).json({
            message: 'Регистрация прошла успешно',
            apiKey
        })
    } catch (err) {
        console.error('Ошибка при регистрации:', err.message)
        return res.status(500).json({ message: 'Не удалось зарегистрировать пользователя' })
    }
})

app.post('/auth', async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { username, password } = body

    if (typeof username !== 'string' && typeof password !== 'string') {
        return res.status(400).json({message: 'Нужно указать имя пользователя и пароль'});
    }
    if (typeof username !== 'string') {
        return res.status(400).json({message: 'Вы не указали имя пользователя'});
    }
    if (typeof password !== 'string') {
        return res.status(400).json({message: 'Вы не ввели пароль'});
    }
    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
        return res.status(400).json({ message: 'Имя пользователя и пароль не должны быть пустыми' })
    }

    try {
        const apiKey = randomBytes(32).toString('hex')
        const hashedApiKey = createHash('sha256').update(apiKey).digest('hex')

        const user = await checkUser(normalizedUsername)

        if (!user) {
            return res.status(400).json("Пользователь с таким именем не найден")
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password)

        if (!isValidPassword) {
            return res.status(400).json({message: "Вы ввели неправильный пароль"})
        }
        try {
        await newToken(hashedApiKey, user.id)
        } catch(err) {
            console.error("Ошибка при записи токена в бд: ", err.message)
            return res.status(500).json({message: "Не удалось записать токен в базу данных"})
        }

        return res.status(201).json({
            message: "Успешный вход",
        apiKey})

    } catch(err) {
        console.error('Ошибка при входе:', err.message)
        return res.status(500).json({message: "Попытка входа не удалась"})
    }

})

const isMainModule = process.argv[1]
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isMainModule) {
    startPriceUpdates()
    const server = app.listen(port, '127.0.0.1', () => {
        console.log(`Server is running at http://localhost:${port}`)
    })
    setupShutdown(server)
}

export default app