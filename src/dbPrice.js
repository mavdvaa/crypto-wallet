import db from "./db.js"

export function addNewCrypto(user_id, symbol, name) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO wallet (user_id, crypto, name)
            VALUES (?, ?, ?)`,
            [user_id, symbol, name],
            (err) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve()
            }
        )
    })
}

export function listOfPrices(crypto, length) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT crypto, price, time FROM prices
            WHERE crypto = ?
            ORDER BY time DESC
            LIMIT ?`,
            [crypto, length],
            (err, rows) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(rows)
            }
        )
    })
}

export function addEntry(crypto, price) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO prices (crypto, price) VALUES (?, ?)',
            [crypto, price],
            (err) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve()
            }
        )
    })
}
