#!/bin/bash
#? Package the app

set -e

NODE_VERSION="$(node --version)"
if [ "$NODE_VERSION" != "v5.1.1" ]; then
    echo "ERROR: Node version should be 5.1.1, got $NODE_VERSION instead"
    exit 1
fi

BUILD_DIR='./build'

echo "-- REMOVING DIST FOLDER --"
if [ -d "$BUILD_DIR" ]; then
    rm -r "$BUILD_DIR"
fi

echo "-- BUILDING PRODUCTION APP --"
cross-env NODE_ENV=production webpack --config ./webpack/webpack.config.production.babel.js

echo "-- COPYING REMAINING FILES --"

# Copy package JSON
cp app/package.json "$BUILD_DIR"

# Copy some things
cp -r app/ui/external assets/* app/main.js "$BUILD_DIR/"

echo "-- INSTALLING PACKAGES --"

cd "$BUILD_DIR"/
cross-env NODE_ENV=production npm install

echo "-- BUILD COMPLETE --"
