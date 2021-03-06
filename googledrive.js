const express = require('express')
const { google } = require('googleapis')
const convert = require('heic-convert')
const credentials = require('./credentials.json')
const fs = require('fs')
const path = require('path')
const util = require('util')
const { exec } = require('child_process')

const readdirPromise = util.promisify(fs.readdir)
const readFilePromise = util.promisify(fs.readFile)
const writeFilePromise = util.promisify(fs.writeFile)
const rmPromise = util.promisify(fs.rm)
const statPromise = util.promisify(fs.stat)
const execPromise = util.promisify(exec)

const BIG_WEG_FOLDER_ID = '1EnEJ1P2kqEjbFChLvIPRp5FUDRyq-C5A'
const SUPPORTED_TYPES = ['.apng', '.avif', '.gif', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.png', '.svg', '.webp']

const ImageCache = () => {
	const router = express.Router()

	// configure GDrive auth
	const scopes = ['https://www.googleapis.com/auth/drive']
	const auth = new google.auth.JWT(
		credentials.client_email, null,
		credentials.private_key, scopes
	)
	const drive = google.drive({ version: 'v3', auth })

	router.post('/', async (req, res, next) => {
		// first, list files in public Drive folder
		let images = []
		let localFiles = await readdirPromise(path.join(__dirname, 'images'))
		try {
			let response = await drive.files.list({q: `'${BIG_WEG_FOLDER_ID}' in parents`})
			images = response.data.files
		} catch (e) {
			console.error(e)
			next({
				status: 500,
				message: 'Internal error occurred while querying Google Drive'
			})
		}

		// set of final assets that we will return
		let assets = []

		// then, attempt to download files if they don't exist
		try {
			for (let image of images) {
				// if file is already downloaded, use cached version
				if (localFiles.includes(image.name)) {
					console.log(`Cached ${image.name} (${image.id})`)
					assets.push(image.name)
					continue
				}

				// check for .gif conversion of .mov files
				let filename = image.name.split('.').slice(0, -1).join('.')
				if (localFiles.includes(`${filename}.gif`)) {
					console.log(`Cached ${filename}.gif (${image.id})`)
					assets.push(`${filename}.gif`)
					continue
				}

				// check for .jpeg conversion of .heic files
				if (localFiles.includes(`${filename}.jpeg`)) {
					console.log(`Cached ${filename}.jpeg (${image.id})`)
					assets.push(`${filename}.jpeg`)
					continue
				}

				// attempt to download
				let dest = fs.createWriteStream(path.join(__dirname, 'images', `${image.name}`))
				try {
					let retries = 3
					while (retries > 0) {
						// we must manually promisify the Google Drive API...wow
						await new Promise((resolve, reject) => {
							drive.files.get(
								{fileId: image.id, alt: 'media'},
								{responseType: 'stream'},
								(err, res) => {
									res.data.on('end', () => resolve()).on('error', () => reject()).pipe(dest)
								}
							)
						})

						let stats = await statPromise(path.join(__dirname, 'images', `${image.name}`))
						if (stats.size === 0) {
							retries -= 1
						} else {
							console.log(`Downloaded ${image.name} (${image.id})`)
							break
						}
					}
					if (retries <= 0) {
						console.error(`Failed all download attempts for ${image.name} (${image.id})`)
					}
					assets.push(image.name)
				} catch (e) {
					console.error(e)
					console.error(`Could not download ${image.name} (${image.id})`)
				}
			}
		} catch (e) {
			console.error(e)
			next({
				status: 500,
				message: 'Internal error occurred while querying Google Drive'
			})
		}

		// update local files based on downloads
		localFiles = await readdirPromise(path.join(__dirname, 'images'))

		// we also need to convert .heic --> .jpeg and .mov --> .gif
		for (let f of localFiles) {
			if (f.endsWith('.heic') || f.endsWith('.HEIC')) {
				console.log(`Converting ${f} to .jpeg`)
				try {
					let inputBuffer = await readFilePromise(path.join(__dirname, 'images', f))
					const outputBuffer = await convert({
						buffer: inputBuffer,
						format: 'JPEG',
						quality: 1
					})
					let filename = f.split('.').slice(0, -1).join('.') + '.jpeg'
					await writeFilePromise(path.join(__dirname, 'images', filename), outputBuffer)
					assets.push(filename)
				} catch (e) {
					console.error(e)
					console.error(`Could not convert ${f} to .jpeg`)
				}
			} else if (f.endsWith('.mov') || f.endsWith('.MOV')) {
				console.log(`Converting ${f} to .gif`)
				try {
					let filename = f.split('.').slice(0, -1).join('.') + '.gif'
					let inputPath = path.join(__dirname, 'images', f)
					let outputPath = path.join(__dirname, 'images', filename)
					await execPromise(`ffmpeg -i "${inputPath}" "${outputPath}"`)
					assets.push(filename)
				} catch (e) {
					console.error(e)
					console.error(`Could not convert ${f} to .gif`)
				}
			}
		}

		// filter proper assets and shuffle
		assets = assets.filter(a => {
			let ext = '.' + a.split('.').splice(-1, 1)
			if (!SUPPORTED_TYPES.includes(ext.toLowerCase())) {
				return false
			}
			return true
		})
		// randomize array in-place using Durstenfeld shuffle algorithm
		const shuffle = (array) => {
			for (var i = array.length - 1; i > 0; i--) {
				var j = Math.floor(Math.random() * (i + 1))
				var temp = array[i]
				array[i] = array[j]
				array[j] = temp
			}
		}
		shuffle(assets)
		
		// report back list of IDs so they can be served as static files
		next({
			status: 200,
			data: assets.map(a => {return {path: `images/${a}`, name: a.split('.').slice(0, -1).join('.')}})
		})
	})

	return router
}

const Cleaner = () => {
	const router = express.Router()
	router.post('/', async (req, res, next) => {
		console.log('in cleanup step')

		// configure GDrive auth
		const scopes = ['https://www.googleapis.com/auth/drive']
		const auth = new google.auth.JWT(
			credentials.client_email, null,
			credentials.private_key, scopes
		)
		const drive = google.drive({ version: 'v3', auth })

		// check for list of cloud images
		let images = []
		const localFiles = await readdirPromise(path.join(__dirname, 'images'))
		try {
			let response = await drive.files.list({q: `'${BIG_WEG_FOLDER_ID}' in parents`})
			images = response.data.files.map(i => i.name)
		} catch (e) {
			console.error(e)
		}

		// prune local files
		for (let f of localFiles) {
			let ext = '.' + f.split('.').splice(-1, 1)
			let filename = f.split('.').slice(0, -1).join('.')
			let absPath = path.join(__dirname, 'images', f)
			
			// if image is not of a supported type
			if (!SUPPORTED_TYPES.includes(ext.toLowerCase())) {
				console.log(`Removing ${f}`)
				await rmPromise(absPath)
			}
			// if image is locally cached but no longer in cloud
			if (!images.includes(f)) {
				// if image is not conversion to supported file type (.heic --> .jpeg, .mov --> .gif)
				if (!(images.includes(`${filename}.mov`) || !images.includes(`${filename}.MOV`) || !images.includes(`${filename}.heic`) || !images.includes(`${filename}.HEIC`))) {
					console.log(`Removing ${f}`)
					await rmPromise(absPath)
				}
			}
		}
		next({
			status: 200,
			message: 'Cleaned up files on server'
		})
	})
	return router
}

module.exports = {
	ImageCache,
	Cleaner
}
