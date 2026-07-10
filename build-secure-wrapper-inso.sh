
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

# use this if you just want to rebuild the wrapper so you can copy into an existing binaries/ folder
if [ "$BUILD_CONTEXT" == "SOLO" ]; then
  DEST_EXE=$CPP_DIR/inso.exe
fi

if [ -n "$TAG" ]; then
  TAG="-$TAG"
fi

# if an arg is not passed (SOLO, CI), rebuild the raw pkg binary first
if [ ! $BUILD_CONTEXT ]; then
  echo "Building inso pkg binary..."
  npm run build:production -w insomnia-inso
  npm run package -w insomnia-inso
fi

# preserve the real payload under its own name BEFORE the wrapper overwrites binaries/inso.exe
cp $DEST_DIR/inso.exe $DEST_DIR/inso-core-$VERSION.exe

echo "Injecting version strings..."
sed "s/__VERSION__/$VERSION/g; s/__SIGNER__/${INSO_SIGNER_SUBSTRING:-Kong}/g" $CPP_DIR/inso.cpp > $CPP_DIR/final.cpp
sed "s/__MAJOR__/$MAJOR/g" $CPP_DIR/resources.rc > $CPP_DIR/final.rc
sed -i "s/__MINOR__/$MINOR/g" $CPP_DIR/final.rc
sed -i "s/__PATCH__/$PATCH/g" $CPP_DIR/final.rc
sed -i "s/__TAG__/$TAG/g" $CPP_DIR/final.rc
sed -i "s/__YEAR__/$(date +%Y)/g" $CPP_DIR/final.rc

echo "Compiling resources..."
windres $CPP_DIR/final.rc $CPP_DIR/res.o

echo "Compiling inso wrapper..."
g++ -lkernel32 -mconsole -municode -c $CPP_DIR/final.cpp -o $CPP_DIR/inso.o

echo "Linking inso wrapper..."
g++ -O2 -static -static-libgcc -static-libstdc++ -mconsole -municode -lwinpthread -lwintrust -lcrypt32 $CPP_DIR/inso.o $CPP_DIR/res.o -o $DEST_EXE

echo "Secure wrapper built successfully."
echo "Done."
