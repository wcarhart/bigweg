#!/bin/bash

# version of node to install
NODE_VERSION=15.14.0
# location of the repo from stash to keep all npm/yarn packages
PKGS=$HOME/.kickstart/dump-yarn/pkgs

# only run if node version is not current
if [[ "$(node --version)" == "v${NODE_VERSION}" ]]; then
	echo "node v${NODE_VERSION} already installed, exiting ${0}"
	# cannnot use exit 0 because we call script with source and will exit entire shell
else
	# remove old stuff
	rm $HOME/.npmrc
	rm $HOME/.yarnrc

	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash

	# setup the variables
	source $HOME/.nvm/nvm.sh

	# install version of node and setup under nvm
	nvm install v$NODE_VERSION
	nvm use $NODE_VERSION
	nvm alias default $NODE_VERSION

	# install yarn, package manager to replace npm, globally to nvm
	npm install -g yarn

	# setup the config to use offline mirror capability
	yarn config set yarn-offline-mirror "$PKGS"
	yarn cache clean
fi
