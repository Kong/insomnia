
# if you're curious about what this does and why it's here,
# see packages/insomnia-inso/src/cpp/README.md

set -e

BUILD_CONTEXT=$1
VERSION=$(jq .version ./packages/insomnia-inso/package.json -rj)
echo "Starting inso secure wrapper build for version $VERSION..."
MAJOR=$(echo $VERSION | cut -d '.' -f 1)
MINOR=$(echo $VERSION | cut -d '.' -f 2)
PATCH=$(echo $VERSION | cut -d '.' -f 3 | cut -d '-' -f 1)
TAG=$(echo $VERSION | cut -d '-' -f 2)
SRC_DIR=packages/insomnia-inso/src
CPP_DIR=$SRC_DIR/cpp
DEST_DIR=packages/insomnia-inso/binaries
DEST_EXE=$DEST_DIR/inso.exe

if [ -n "$TAG" ]; then
  TAG="-$TAG"
fi

# if an arg is not passed (SOLO, CI), rebuild the raw pkg binary first
if [ ! $BUILD_CONTEXT ]; then
  echo "Building inso pkg binary..."
  npm run build:production -w insomnia-inso
  npm run package -w insomnia-inso
fi

# preserve the real payload under a disguised name BEFORE the wrapper overwrites binaries/inso.exe.
# Skip if already renamed (e.g. re-running this script without rebuilding the pkg binary).
if [ -f $DEST_DIR/inso.exe ]; then
  echo "Renaming inso.exe to inso-node.dll..."
  mv $DEST_DIR/inso.exe $DEST_DIR/inso-node.dll
elif [ ! -f $DEST_DIR/inso-node.dll ]; then
  echo "Neither inso.exe nor inso-node.dll found in $DEST_DIR — run 'npm run inso-package' first."
  exit 1
fi

echo "Injecting version strings..."
sed "s/__MAJOR__/$MAJOR/g" $CPP_DIR/resources.rc > $CPP_DIR/final.rc
sed -i "s/__MINOR__/$MINOR/g" $CPP_DIR/final.rc
sed -i "s/__PATCH__/$PATCH/g" $CPP_DIR/final.rc
sed -i "s/__TAG__/$TAG/g" $CPP_DIR/final.rc
sed -i "s/__YEAR__/$(date +%Y)/g" $CPP_DIR/final.rc

echo "Compiling resources..."
windres $CPP_DIR/final.rc $CPP_DIR/res.o

echo "Compiling inso wrapper..."
gcc -O2 -c $CPP_DIR/inso.c -o $CPP_DIR/inso.o

echo "Linking inso wrapper..."
# -nostdlib: no CRT startup, so nothing runs (and no DLL can load) before EntryPoint calls
# ApplyMitigations(). Only KERNEL32.dll is a static import; wintrust.dll/crypt32.dll are
# loaded dynamically at runtime, after the mitigation is already active (see inso.c).
gcc -O2 -nostdlib -Wl,--entry,EntryPoint -Wl,--subsystem,console \
    $CPP_DIR/inso.o $CPP_DIR/res.o -lkernel32 -o $DEST_EXE

echo "Secure wrapper built successfully."
echo "Done."
