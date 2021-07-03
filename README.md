# Big Weg
Memorial site for Reggie.

### Deploy
Simple Express app deployed via DigitalOcean. To deploy:
```bash
source setup.sh
./deploy.sh
```

### About
Express app is in `index.js`. Utilizes `googledrive.js` to pull images from Google Drive folder and caches locally. Serves public front-end out of `public/`.
