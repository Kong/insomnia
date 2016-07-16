#!/bin/bash
#? Package the app

echo "-- REMOVING DIST FOLDER --"
rm -r dist/*

echo "-- BUILDING PRODUCTION APP --"
NODE_ENV=production node -r babel-register ./node_modules/.bin/webpack --config ./webpack/webpack.config.production.js

echo "-- COPYING REMAINING FILES --"

# Make package.json and app.json
# TODO: Remove the need have both of these
cp app/app.json dist/package.json
cp app/app.json dist/app.json

# Copy some other things
cp app/app.js dist/
cp -r app/images dist/
cp -r app/external dist/

echo "-- INSTALLING PACKAGES --"

cd dist/; NODE_ENV=production npm install; cd ..

