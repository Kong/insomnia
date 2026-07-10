
# see packages/insomnia-inso/installer/inso-installer.nsi for what this builds

set -e

VERSION=$(jq .version ./packages/insomnia-inso/package.json -rj)
INSTALLER_DIR=packages/insomnia-inso/installer

mkdir -p packages/insomnia-inso/artifacts

# NSIS's File directive resolves relative paths against the .nsi script's own directory,
# not the process's working directory — pass absolute, native Windows-style paths instead
# (cygpath converts this shell's POSIX-style path to the C:\... form makensis.exe needs).
ROOT_WIN=$(cygpath -w "$(pwd)")
BINARIES_DIR="$ROOT_WIN\\packages\\insomnia-inso\\binaries"
OUT_DIR="$ROOT_WIN\\packages\\insomnia-inso\\artifacts"

echo "Building inso-installer.exe for version $VERSION..."
makensis -DVERSION=$VERSION -DBINARIES_DIR="$BINARIES_DIR" -DOUT_DIR="$OUT_DIR" $INSTALLER_DIR/inso-installer.nsi
echo "Done. See $OUT_DIR\\inso-installer.exe"
