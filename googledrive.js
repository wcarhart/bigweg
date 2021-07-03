const express = require('express')
const fetch = require('node-fetch')
const { google } = require('googleapis')
const credentials = require('./credentials.json')
const fs = require('fs')
const path = require('path')
const util = require('util')

const readdirPromise = util.promisify(fs.readdir)
const rmPromise = util.promisify(fs.rm)
const statPromise = util.promisify(fs.stat)

const BIG_WEG_FOLDER_ID = '1EnEJ1P2kqEjbFChLvIPRp5FUDRyq-C5A'

const googleDrive = (opts) => {
	const router = express.Router()

	// configure GDrive auth
	const scopes = ['https://www.googleapis.com/auth/drive']
	const auth = new google.auth.JWT(
		credentials.client_email, null,
		credentials.private_key, scopes
	)
	const drive = google.drive({ version: "v3", auth })

	router.post('/', async (req, res, next) => {
		// first, list files in public Drive folder
		let images = []
		const localFiles = await readdirPromise('images')
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

		// then, attempt to download files if they don't exist
		try {
			for (let image of images) {
				// if file is already downloaded, use cached version
				if (localFiles.includes(image.name)) {
					console.log(`Cached ${image.name} (${image.id})`)
					continue
				}
				let dest = fs.createWriteStream(path.join('images', `${image.name}`))
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

						let stats = await statPromise(path.join('images', `${image.name}`))
						if (stats.size === 0) {
							retries -= 1
						} else {
							console.log(`Downloaded ${image.name} (${image.id})`)
							break
						}
					}
					if (retries <= 0) {
						console.error(`Failed all download attemps for ${image.name} (${image.id})`)
					}
				} catch (e) {
					console.error(e)
					console.log(`Could not download ${image.name} (${image.id})`)
				}
			}
		} catch (e) {
			console.error(e)
			next({
				status: 500,
				message: 'Internal error occurred while querying Google Drive'
			})
		}

		// next, attempt to clean up any images that were deleted in cloud
		let cloudFiles = images.map(i => i.name)
		for (let f of localFiles) {
			if (!cloudFiles.includes(f)) {
				console.log(`Removing ${f}`)
				await rmPromise(path.join('images', f))
			}
		}

		// finally, report back list of IDs so they can be served as static files
		next({
			status: 200,
			files: cloudFiles.map(cf => `images/${cf}`)
		})
	})

	return router
}

module.exports = googleDrive
