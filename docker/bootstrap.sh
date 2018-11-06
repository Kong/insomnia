#!/usr/bin/env bash

# Fail on any errors
set -e

# Install root project dependencies
npm run bootstrap
npm install --no-save 7zip-bin-linux app-builder-bin-linux

