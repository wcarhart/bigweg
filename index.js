const path = require('path')
const fs = require('fs')

const fetch = require('node-fetch')
const express = require('express')
const { google } = require('googleapis')

const gd = require('./googledrive.js')

const IMG_DIR = 'images'
const PORT = 80

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

// serve static image files
// app.use(express.static(path.join(__dirname, IMG_DIR)))
app.use(`/${IMG_DIR}`, express.static(path.join(__dirname, IMG_DIR)))

// serve UI
app.get('/', express.static(path.join(__dirname, 'public')))
app.get('/favicon.png', express.static(path.join(__dirname, 'public')))

// download images from Google Drive
app.use('/refresh', gd())

// log errors
app.use((err, req, res, next) => {
	console.error(err)
	res.json(err)
})

// start app
app.listen(PORT, '0.0.0.0', () => {
	if (!fs.existsSync(IMG_DIR)){
		fs.mkdirSync(IMG_DIR);
	}
	console.log(`port: ${PORT}`)
})
