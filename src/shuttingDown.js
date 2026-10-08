import db from './db.js'
import { stopPriceUpdates } from './binanceCheck.js'

export function setupShutdown(server) {
    let stop = false

    async function shutdown(signal) {
        if (stop) return
        stop = true

        console.log(`Получен ${signal}`)

        try {
            await stopPriceUpdates()
        } catch (err) {
            console.error('Ошибка при остановке обновления цен:', err.message)
            process.exitCode = 1
        }

        server.close((serverError) => {
            if (serverError) {
                console.error('Ошибка при закрытии HTTP-сервера:', serverError.message)
                process.exitCode = 1
            }

            db.close((dbError) => {
                if (dbError) {
                    console.error('Ошибка при закрытии базы данных:', dbError.message)
                    process.exitCode = 1
                } else {
                    console.log('Сервер и база данных закрыты')
                }
            })
        })
    }

    process.once('SIGINT', () => shutdown('SIGINT'))
    process.once('SIGTERM', () => shutdown('SIGTERM'))
}