#!/bin/bash

# THIS IS A LOOSE SET OF STEPS, NOT A WORKING SCRIPT

# create user
sudo useradd -m weg
sudo passwd weg
sudo usermod --shell /bin/bash weg
sudo usermod -aG sudo weg
sudo su weg

# install node + yarn
# get NVM from here: https://github.com/nvm-sh/nvm
nvm --version
nvm ls-remote
nvm install 15.14.0
npm install --global yarn

# install ffmpeg for video conversions
sudo apt install ffmpeg

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
node index.js # should run app

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

# to redeploy or update
pm2 stop index
# make your changes (e.g. `git pull`)
pm2 start index

# to verify systemctl service
sudo systemctl status pm2-weg.service
sudo journalctl -xe -u pm2-weg.service

# to view application logs
pm2 logs index

# should probably set up NGINX as reverse proxy: https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04
# need to fix SSL
# don't forget to configure DNS
