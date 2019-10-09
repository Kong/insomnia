#!/bin/sh

if [[ -z "$GITHUB_WORKSPACE" ]]; then
  echo "Set the GITHUB_WORKSPACE env variable."
  exit 1
fi

# Fail on any errors
set -e

# Install root project dependencies
cd "$GITHUB_WORKSPACE"
npm run bootstrap
npm install --no-save 7zip-bin-linux app-builder-bin-linux

