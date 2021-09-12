const express = require('express')
const bcrypt = require('bcrypt-nodejs')
const cors = require('cors')
const knex = require('knex')
const Clarifai = require('clarifai')

const app = express()
app.use(express.json())
app.use(cors())

const clarifaiApp = new Clarifai.App({
    apiKey: process.env.API_CLARIFAI
})

const db = knex(
    {
        client: 'pg',
        connection: {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        }
    }
);

app.get('/', (_, res) => {
    db.select().table('users')
        .then(resp => {
            resp.status(200).json('Here')
        })
        .catch(err => {
            res.status(400).json("Unable to connect...")
        })
})

app.post('/signin', (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
        return res.status(400).json('Invalid registration')
    }
    db.select('email', 'password').from('login')
        .where('email', '=', email)
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].password)
            if (isValid) {
                return db.select('*').from('users')
                    .where('email', '=', email)
                    .then(foundUser => {
                        res.status(200).json(foundUser[0])
                    })
                    .catch(err => {
                        res.status(400).json("Error signing in...")
                    })
            } else {
                res.status(400).json("Error signing in...")
            }
        })
        .catch(err => {
            res.status(400).json("Error signing in...")
        })
})

app.post('/register', (req, res) => {
    const { email, name, password } = req.body
    if (!email || !name || !password) {
        return res.status(400).json('Invalid registration')
    }
    const hash = bcrypt.hashSync(password)
    db.transaction(trx => {
        trx.insert({
            email: email,
            password: hash
        })
            .into('login')
            .returning('email')
            .then(loginEmail => {
                return trx('users')
                    .returning('*')
                    .insert(
                        {
                            name: name,
                            email: loginEmail[0],
                            joined: new Date()
                        },
                    )
                    .then(newUser => {
                        res.status(200).json(newUser[0])
                    })
            })
            .then(trx.commit)
            .catch(trx.rollback)
    })
        .catch(err => {
            res.status(400).json("Unable to join...")
        })
})

app.get('/profile/:id', (req, res) => {
    const { id } = req.params
    db.select('*').from('users').where({ id })
        .then(foundUser => {
            if (foundUser.length) {
                res.status(200).json({
                    status: 200,
                    user: foundUser[0]
                })
            } else {
                res.status(404).json("Error getting user...")
            }
        })
        .catch(err => {
            res.status(404).json("Error, please try again...")
        })
})

app.post('/imageurl', (req, res) => {
    clarifaiApp.models
        .predict(
            'f76196b43bbd45c99b4f3cd8e8b40a8a',
            req.body.input)
        .then(data => {
            res.json(data)
        })
        .catch(err => res.status(400).json('Unable to work with API'))
})

app.put('/image', (req, res) => {
    const { id } = req.body
    db('users').where({ id })
        .increment('entries', 1)
        .returning('entries')
        .then(entryNum => {
            res.status(200).json({
                status: 200,
                entries: entryNum[0]
            })
        })
        .catch(err => {
            res.status(400).json("Error retrieving entries")

        })
})

app.listen(process.env.PORT || 3001, () => {
    console.log(`App is running on port ${process.env.PORT}`)
})