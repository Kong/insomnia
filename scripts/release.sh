#!/bin/bash
#? Package and ready the app

echo "-- PACKAGING APP... --"
cp assets/* build/

#node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --mac
node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --win

# TODO: Sort Linux builds out
#node node_modules/electron-builder/out/build-cli.js --publish='never' --x64 --linux

#Building:
#  --mac, -m, -o, --osx, --macos  Build for MacOS, accepts target list (see
#                                 https://goo.gl/HAnnq8).                 [array]
#  --linux, -l                    Build for Linux, accepts target list (see
#                                 https://goo.gl/O80IL2)                  [array]
#  --win, -w, --windows           Build for Windows, accepts target list (see
#                                 https://goo.gl/dL4i8i)                  [array]
#  --x64                          Build for x64                         [boolean]
#  --ia32                         Build for ia32                        [boolean]
#  --dir                          Build unpacked dir. Useful to test.   [boolean]
#
#Publishing:
#  --publish, -p  Publish artifacts (to GitHub Releases), see
#                 https://goo.gl/WMlr4n
#                           [choices: "onTag", "onTagOrDraft", "always", "never"]
#  --draft        Create a draft (unpublished) release                  [boolean]
#  --prerelease   Identify the release as a prerelease                  [boolean]
#
#Deprecated:
#  --platform  The target platform (preferred to use --mac, --win or --linux)
#               [choices: "mac", "osx", "win", "linux", "darwin", "win32", "all"]
#  --arch      The target arch (preferred to use --x64 or --ia32)
#                                                 [choices: "ia32", "x64", "all"]
#
#Other:
#  --help     Show help                                                 [boolean]
#  --version  Show version number                                       [boolean]
#
#Examples:
#  build -mwl                build for MacOS, Windows and Linux
#  build --linux deb tar.xz  build deb and tar.xz for Linux
#  build --win --ia32        build for Windows ia32
#
#See the Wiki (https://github.com/electron-userland/electron-builder/wiki) for
#more documentation.

echo "-- PACKAGED --"
