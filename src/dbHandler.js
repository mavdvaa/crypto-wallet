import db from "./db.js"

export function addUser(username, password, hashedApiKey) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO users (username, password, token) VALUES (?, ?, ?)',
            [username, password, hashedApiKey],
            function (err) {
                if (err) {
                    reject(err)
                    return
                }

                resolve()
            }
        )
    })
}

export function checkUser(username) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM users WHERE username = ?',
            [username],
            (err, user) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(user)
            }
        )
    })
}

export function getUserByTokenHash(tokenHash) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT id, username FROM users WHERE token = ?',
            [tokenHash],
            (err, user) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(user)
            }
        )
    })
}

export function newToken(token, id) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE users
            SET token = ?
            WHERE id = ?`,
            [token, id],
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