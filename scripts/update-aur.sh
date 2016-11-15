#!/bin/bash

APP_VERSION=$(node -e "console.log(require('./build/package.json').version)")
HASH=$(md5 ./dist/insomnia-*.deb)

echo "$HASH for $APP_VERSION"
