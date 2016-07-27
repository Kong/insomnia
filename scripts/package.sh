#!/bin/bash
#? Package and generate installers

echo "-- STARTING PACKAGING PROCESS... --"
say "Beginning platform builds"
cp assets/* build/

echo "-- PACKAGING WINDOWS --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --win
say "Windows build complete"

echo "-- PACKAGING MAC --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --mac
say "Mac build complete"

echo "-- PACKAGING LINUX --"
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --linux
say "Linux build complete"

echo "-- PACKAGING COMPLETE --"
say "All builds have now completed"
