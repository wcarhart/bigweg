# Big Weg
Memorial site for Reggie.

### Deploy
Simple Express app deployed via DigitalOcean. To deploy, see `deploy.sh`.

If LetEncrypt SSL certificate expires, use:
```bash
pm2 stop weg
sudo certbot renew --standalone
pm2 start weg
```

### About
Express app is in `index.js`. Utilizes `googledrive.js` to pull images from Google Drive folder and caches locally. Serves public front-end out of `public/`.
