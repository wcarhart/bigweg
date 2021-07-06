#!/bin/bash

# THIS IS A LOOSE SET OF STEPS, NOT A WORKING SCRIPT

# create user
sudo useradd -m weg
sudo passwd weg
sudo usermod --shell /bin/bash weg
sudo usermod -aG sudo weg
sudo su weg
cd
sudo apt-get update

# create group with root and weg (Node.js user) as members
sudo addgroup nodecert
sudo adduser weg nodecert
sudo adduser root nodecert

# install node + yarn
# get NVM from here: https://github.com/nvm-sh/nvm
nvm --version
nvm ls-remote
nvm install 15.14.0
npm install --global yarn

# install ffmpeg for video conversions
sudo apt install ffmpeg

# set up dependencies for SSL
sudo apt-get install software-properties-common
sudo add-apt-repository universe
sudo apt-get update
sudo apt-get install certbot # or, install from https://certbot.eff.org/lets-encrypt/ubuntubionic-nginx.html

# configure SSL
# tutorial: https://dev.to/omergulen/step-by-step-node-express-ssl-certificate-run-https-server-from-scratch-in-5-steps-5b87
sudo certbot certonly --standalone
sudo chgrp -R nodecert /etc/letsencrypt/live
sudo chgrp -R nodecert /etc/letsencrypt/archive
sudo chmod -R 750 /etc/letsencrypt/live
sudo chmod -R 750 /etc/letsencrypt/archive
# hint (answer and comments): https://stackoverflow.com/a/54903098/6246128

# open port access for node
sudo apt-get install libcap2-bin
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``

# set up app
mkdir ~/code && cd ~/code
git clone https://github.com/wcarhart/bigweg.git
cd bigweg
mkdir images
./ssl.sh
yarn install
# get credentials.json from GCP
node index.js # should run app, ^C to exit

# set up service
npm install pm2@latest -g
pm2 --version
pm2 start index.js
pm2 startup systemd
sudo env PATH=$PATH:/home/weg/.nvm/versions/node/v15.14.0/bin /home/weg/.nvm/versions/node/v15.14.0/lib/node_modules/pm2/bin/pm2 startup systemd -u weg --hp /home/weg
pm2 save
sudo systemctl start pm2-weg # if this fails, do `sudo reboot` and rerun this step and then continue
systemctl status pm2-weg
# may have to do `pm2 start index.js` again to pull things back up
pm2 restart index --name weg
pm2 save

# to redeploy or update
pm2 status weg
pm2 stop weg
# make your changes (e.g. `git pull`)
pm2 start weg

# to verify systemctl service
sudo systemctl status pm2-weg.service
sudo journalctl -xe -u pm2-weg.service

# to view application logs
pm2 logs weg

# need to fix SSL
# don't forget to configure DNS
