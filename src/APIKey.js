import { createHash } from 'node:crypto'
import { getUserByTokenHash } from './dbHandler.js'

export async function requireApiKey(req, res, next) {
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') ?? '')

    if (!match) {
        return res.status(401).json({ message: 'Доступ запрещён: укажите API key в заголовке Authorization: Bearer' })
    }

    const apiKeyHash = createHash('sha256').update(match[1]).digest('hex')

    try {
        const user = await getUserByTokenHash(apiKeyHash)

        if (!user) {
            return res.status(401).json({ message: 'Доступ запрещён: неверный API key' })
        }

        req.user = user
        return next()
    } catch (err) {
        console.error('Ошибка проверки токена:', err.message)
        return res.status(500).json({ error: 'Не удалось проверить доступ' })
    }
}
