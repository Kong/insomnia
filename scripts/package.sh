#!/bin/bash
#? Package and generate installers

echo "-- STARTING PACKAGING PROCESS... --"
say "Beginning platform packaging"
cp assets/* build/

echo "-- PACKAGING WINDOWS --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --win
say "Windows packaging complete"

echo "-- PACKAGING MAC --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --mac
say "Mac packaging complete"

echo "-- PACKAGING LINUX --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --linux
say "Linux packaging complete"

echo "-- PACKAGING COMPLETE --"
say "All platforms are now packaged"
