#!/bin/bash
#? Package and generate installers

echo "-- STARTING PACKAGING PROCESS... --"
cp assets/* build/

echo "-- PACKAGING MAC --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --mac

echo "-- PACKAGING WINDOWS --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --win

# TODO: This
#echo "-- PACKAGING LINUX --"
#node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --linux

echo "-- PACKAGING COMPLETE --"
