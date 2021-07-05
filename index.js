const crypto = require('crypto')
const http = require('http')
const https = require('https')
const path = require('path')
const fs = require('fs')

const fetch = require('node-fetch')
const express = require('express')
const errorHandler = require('errorhandler')
const { google } = require('googleapis')

const gd = require('./googledrive.js')

const PORT = 80

const privateKey = fs.readFileSync('privatekey.pem').toString()
const certificate = fs.readFileSync('certificate.pem').toString()
let options = {
  key: privateKey,
  cert: certificate
}

// configure express app
const app = express()
app.use(express.json())
app.set('json spaces', 2)

const routeLogger = () => {
  const router = express.Router()
  router.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`)
    next()
  })
  return router
}

// allow cors so can call from another web client
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

// log all HTTP routes
app.use(routeLogger())
app.use(errorHandler({ dumpExceptions: true, showStack: true }))

// serve static image files
app.use(`/images`, express.static(path.join(__dirname, 'images')))

// serve UI
app.get('/', express.static(path.join(__dirname, 'public')))
app.get('/favicon.png', express.static(path.join(__dirname, 'public')))

// download images from Google Drive
app.use('/refresh', gd())

// log middleware errors
app.use((err, req, res, next) => {
	console.error(err)
	res.json(err)
})

// start app
// DEV
// app.listen(PORT, '0.0.0.0', () => {
// 	console.log(`bigweg server listening on port ${PORT}`)
// })

// PROD
console.log(`bigweg HTTP server listening on port 80`)
console.log(`bigweg HTTPS server listening on port 443`)
http.createServer(app).listen(80)
https.createServer(options, app).listen(443)
