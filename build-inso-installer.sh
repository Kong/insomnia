
# see packages/insomnia-inso/installer/inso-installer.nsi for what this builds

set -e

VERSION=$(jq .version ./packages/insomnia-inso/package.json -rj)
BINARIES_DIR=packages/insomnia-inso/binaries
OUT_DIR=packages/insomnia-inso/artifacts
INSTALLER_DIR=packages/insomnia-inso/installer

mkdir -p $OUT_DIR

echo "Building inso-installer.exe for version $VERSION..."
makensis -DVERSION=$VERSION -DBINARIES_DIR=$BINARIES_DIR -DOUT_DIR=$OUT_DIR $INSTALLER_DIR/inso-installer.nsi
echo "Done. See $OUT_DIR/inso-installer.exe"
