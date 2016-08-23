#!/bin/bash
#? Package the app

set -e

BUILD_DIR='./build'

echo "-- REMOVING DIST FOLDER --"
rm -r "$BUILD_DIR"

echo "-- BUILDING PRODUCTION APP --"
cross-env NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./webpack/webpack.config.production.js

echo "-- COPYING REMAINING FILES --"

# Copy package JSON
cp app/app.json "$BUILD_DIR/app.json"
cp app/app.json "$BUILD_DIR/package.json"

# Copy some things
cp app/app.js "$BUILD_DIR/"
cp -r app/images "$BUILD_DIR/"
cp -r app/external "$BUILD_DIR/"

echo "-- INSTALLING PACKAGES --"

cd "$BUILD_DIR"/
cross-env NODE_ENV=production npm install

echo "-- BUILD COMPLETE --"
