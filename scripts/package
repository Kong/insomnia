#!/bin/bash
#? Package the app

echo "-- REMOVING DIST FOLDER --"
rm -r dist/*

echo "-- BUILDING PRODUCTION APP --"
NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./webpack/webpack.config.production.js

echo "-- COPYING REMAINING FILES --"

cp -r app/package.json app/app.js dist/

echo "-- INSTALLING PACKAGES --"

# cp -r app/node_modules dist/
cd dist/; NODE_ENV=production npm install; cd ..

echo "-- PACKAGING APP --"

node -r babel-register node_modules/electron-packager/cli.js \
    dist \
    Insomnia \
    --platform=darwin \
    --arch=x64 \
    --asar \
    --build-version=1 \
    --app-version=3.0.0 \
    --version-string.CompanyName=schier.co \
    --version-string.ProductName="Insomnia REST Client" \
    --version-string.FileDescription="FileDescription" \
    --version-string.OriginalFilename="insomnia" \
    --version-string.InternalName="insomnia" \
    --download.strictSSL=true \
    --icon=assets/icon \
    --out=build \
    --overwrite

echo "-- PACKAGING COMPLETE --"
