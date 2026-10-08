import db from "./db.js"

export function getWallet(user_id) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM wallet
            WHERE user_id = ?`,
            [user_id],
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

export function getWalletCryptos() {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT DISTINCT crypto FROM wallet`,
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

export function updateWalletCryptoInfo(crypto, name) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE wallet
            SET name = ?, updated_at = datetime('now', 'localtime')
            WHERE crypto = ?`,
            [name, crypto],
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

export function updateWallet(newCrypto, crypto, user_id, name) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE wallet
            SET crypto = ?, name = ?, updated_at = datetime('now', 'localtime')
            WHERE crypto = ? AND user_id = ?`,
            [newCrypto, name, crypto, user_id],
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

export function deleteCrypto(user_id, crypto) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM wallet
            WHERE user_id = ? AND crypto = ?`,
            [user_id, crypto],
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

export function checkCryptoDB(user_id, crypto) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM wallet
            WHERE user_id = ? AND crypto = ?`,
            [user_id, crypto],
            (err, row) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(row)
            }
        )
    })
}