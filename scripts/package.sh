#!/bin/bash
#? Package the app

APP_NAME="Insomnia REST Client"
APP_ID="insomnia"

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
