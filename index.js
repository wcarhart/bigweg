const crypto = require('crypto')
const https = require('https')
const path = require('path')
const fs = require('fs')

const fetch = require('node-fetch')
const express = require('express')
const errorHandler = require('errorhandler')
const { google } = require('googleapis')
const helmet = require('helmet')

const gd = require('./googledrive.js')

const options = {
  PROD: {
    key: fs.readFileSync('/etc/letsencrypt/live/bigweg.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/bigweg.com/fullchain.pem'),
    port: 80
  },
  DEV: {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
    port: 443
  }
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

// enforce HTTPS
app.enable('trust proxy')
app.use((req, res, next) => {
  req.secure ? next() : res.redirect('https://' + req.headers.host + req.url)
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
app.use('/refresh', gd.ImageCache())
app.use('/clean', gd.Cleaner())

// log middleware errors
app.use((err, req, res, next) => {
	console.error(err)
	res.json(err)
})

// DEV
// app.listen(options.DEV.port, '0.0.0.0', () => {
// 	console.log(`bigweg server listening on port ${options.DEV.port}`)
// })

// PROD
console.log(`bigweg HTTPS server listening on port 443`)
https.createServer(options.PROD, app).listen(options.PROD.port)

// enforce HTTPS
// let http = express()
// http.get('*', (req, res) => {
//   console.log(`Redirecting ${req.headers.host + req.url}`)
//   res.redirect('https://' + req.headers.host + req.url);
// })
// http.listen(8080)
