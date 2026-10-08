import sqlite3 from 'sqlite3'

const db = new sqlite3.Database(process.env.DB_PATH || 'database.db', (err) => {
    if (err) {
        console.error("Ошибка подключение к базе данных: ", err.message)
    } else {
        console.log("Базы даных созданы")
    }
})

function run(sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

function all(sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => {
            if (err) {
                reject(err)
                return
            }
            resolve(rows)
        })
    })
}

async function initializeDatabase() {
    await run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        token TEXT UNIQUE
    )`)


    await run(`CREATE TABLE IF NOT EXISTS wallet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    crypto TEXT NOT NULL,
    name TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, crypto)
)`)

    await run(`CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crypto TEXT NOT NULL,
    price REAL NOT NULL,
    time TEXT DEFAULT (datetime('now', 'localtime'))
)`)
}

await initializeDatabase().catch(err => {
    console.error('Ошибка инициализации базы данных:', err.message)
    throw err
})

export default db