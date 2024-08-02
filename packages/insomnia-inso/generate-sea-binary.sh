#!/usr/bin/env bash

# This script should generate a node sea binary
# run with ./packages/insomnia-inso/generate-sea-binary.sh 

set -e
CONFIG_PATH=packages/insomnia-inso/sea-config.json
EXECUTABLE_PATH=packages/insomnia-inso/binaries/inso-sea
SEAPREP_BLOB_PATH=packages/insomnia-inso/binaries/sea-prep.blob

rm -rf $EXECUTABLE_PATH $SEAPREP_BLOB_PATH
node --experimental-sea-config $CONFIG_PATH
cp $(command -v node) $EXECUTABLE_PATH 
codesign --remove-signature $EXECUTABLE_PATH
chmod 777 $EXECUTABLE_PATH
npx postject $EXECUTABLE_PATH NODE_SEA_BLOB $SEAPREP_BLOB_PATH --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA 
