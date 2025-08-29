
# if you're curious about what this does and why it's here,
# see packages/insomnia/src/cpp/README.md

set -e

BUILD_CONTEXT=$1
VERSION=$(jq .version ./packages/insomnia/package.json -rj)
echo "Starting Insomnia secure wrapper build for version $VERSION..."
MAJOR=$(echo $VERSION | cut -d '.' -f 1)
MINOR=$(echo $VERSION | cut -d '.' -f 2)
PATCH=$(echo $VERSION | cut -d '.' -f 3 | cut -d '-' -f 1)
TAG=$(echo $VERSION | cut -d '-' -f 2)
SRC_DIR=packages/insomnia/src
CPP_DIR=$SRC_DIR/cpp
DEST_DIR=packages/insomnia/dist/win-unpacked
DEST_EXE=$DEST_DIR/Insomnia.exe

# use this if you just want to rebuild the wrapper so you can copy into the installation folder
if [ "$BUILD_CONTEXT" == "SOLO" ]; then
  DEST_EXE=$CPP_DIR/Insomnia.exe
fi

if [ -n "$TAG" ]; then
  TAG="-$TAG"
fi

# if an arg is not passed (SOLO, CI), rebuild the unpacked app
if [ ! $BUILD_CONTEXT ]; then
  echo "Building Insomnia electron application..."
  npm run package:windows:unpacked -w insomnia
fi

cp $DEST_DIR/Insomnia.exe $DEST_DIR/insomnia.dll
cp $DEST_DIR/Insomnia.exe $DEST_DIR/Insomnia-origin-$VERSION.exe
cp $SRC_DIR/icons/icon.ico $CPP_DIR/insomnia.ico

echo "Injecting version strings..."
sed "s/__VERSION__/$VERSION/g" $CPP_DIR/insomnia.cpp > $CPP_DIR/final.cpp
sed "s/__MAJOR__/$MAJOR/g" $CPP_DIR/resources.rc > $CPP_DIR/final.rc
sed -i "s/__MINOR__/$MINOR/g" $CPP_DIR/final.rc
sed -i "s/__PATCH__/$PATCH/g" $CPP_DIR/final.rc
sed -i "s/__TAG__/$TAG/g" $CPP_DIR/final.rc
sed -i "s/__YEAR__/$(date +%Y)/g" $CPP_DIR/final.rc

echo "Compiling resources..."
windres $CPP_DIR/final.rc $CPP_DIR/res.o

echo "Compiling Insomnia..."
g++ -lkernel32 -mwindows -c $CPP_DIR/final.cpp -o $CPP_DIR/insomnia.o

echo "Linking Insomnia..."
g++ -O2 -static -static-libgcc -static-libstdc++ -mwindows -lwinpthread $CPP_DIR/insomnia.o $CPP_DIR/res.o -o $DEST_EXE

echo "Secure wrapper built successfully."

if [ ! $BUILD_CONTEXT ]; then
  echo "Packaging distributables..."
  npm run package:windows:dist -w insomnia

  echo "Resetting to prevent accidental loops..."
  mv $DEST_DIR/insomnia.dll $DEST_DIR/Insomnia.exe
fi

echo "Done."
