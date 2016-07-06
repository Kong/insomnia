#!/bin/bash
#? Package the app

APP_NAME="Insomnia REST Client"
APP_ID="insomnia"

echo "-- REMOVING DIST FOLDER --"
rm -r dist/*

echo "-- BUILDING PRODUCTION APP --"
NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./webpack/webpack.config.production.js

echo "-- COPYING REMAINING FILES --"

# Copy some things
cp app/app.json dist/package.json
cp app/app.js dist/

echo "-- INSTALLING PACKAGES --"

#cp -r app/node_modules dist/
cd dist/; NODE_ENV=production npm install; cd ..

echo "-- PACKAGING APP --"

node -r babel-register node_modules/electron-packager/cli.js \
    dist \
    "$APP_NAME" \
    --platform=darwin \
    --arch=x64 \
    --asar \
    --build-version=1 \
    --app-version=3.0.0 \
    --version-string.CompanyName=schier.co \
    --version-string.ProductName="$APP_NAME" \
    --version-string.FileDescription="FileDescription" \
    --version-string.OriginalFilename="$APP_ID" \
    --version-string.InternalName="$APP_ID" \
    --download.strictSSL=true \
    --icon=assets/icon \
    --out=build \
    --overwrite

echo "-- PACKAGING COMPLETE --"
