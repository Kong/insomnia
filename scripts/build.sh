#!/bin/bash
#? Package the app

BUILD_DIR='./build'

echo "-- REMOVING DIST FOLDER --"
rm -r "$BUILD_DIR/*"

echo "-- BUILDING PRODUCTION APP --"
NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./webpack/webpack.config.production.js

echo "-- COPYING REMAINING FILES --"

# Copy some things
cp app/package.json "$BUILD_DIR/package.json"
cp app/app.js "$BUILD_DIR/"
cp -r app/images "$BUILD_DIR/"
cp -r app/external "$BUILD_DIR/"

echo "-- INSTALLING PACKAGES --"

cd "$BUILD_DIR"/
NODE_ENV=production npm install

echo "-- BUILD COMPLETE --"
