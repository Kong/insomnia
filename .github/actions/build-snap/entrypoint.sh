#!/bin/sh

# Fail on any errors
set -e

if [[ -z "$GITHUB_WORKSPACE" ]]; then
  echo "Set the GITHUB_WORKSPACE env variable."
  exit 1
fi

# Install root project dependencies
cd "$GITHUB_WORKSPACE"
npm run bootstrap
npm install --no-save 7zip-bin-linux app-builder-bin-linux

echo "Running the stuff"
npm test

# Log into snapcraft for publishing
echo "$SNAPCRAFT_LOGIN_FILE" > snapcraft.txt && snapcraft login --with snapcraft.txt

npm run app-release