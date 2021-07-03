#!/bin/bash

# install 'bigweg' express app as service
APP=bigweg

# setup yarn
yarn install

# create service file and install
# make the dir to save file in
TMP=tmp/
mkdir -p ${TMP}

# NOTE the hack below for User as systemd doesn't allow dot in usernames.
# make the service file
cat > ${TMP}/${APP}.service << EOL
[Unit]
Description=${APP}
Wants=network-online.target
After=network-online.target

[Service]
Environment="PATH=${NVM_BIN}:$PATH"
ExecStart=${NVM_BIN}/node ${PWD}/${APP}/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${APP}.service
Environment=NODE_ENV=production
User=${UID}

[Install]
WantedBy=multi-user.target
EOL

# show file
cat ${TMP}/${APP}.service

# allow node to run on port 80
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``

# copy to location
sudo cp ${TMP}/${APP}.service /etc/systemd/system/

# reload the daemon
sudo systemctl daemon-reload

# enable the system at boot
sudo systemctl enable ${APP}.service
# to disable the service at boot
# sudo systemctl disable ${APP}.service

# start the application
sudo systemctl restart ${APP}.service
