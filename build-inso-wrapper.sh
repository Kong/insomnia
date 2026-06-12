
# Wraps the pkg-bundled inso.exe with a C++ launcher that applies Windows process
# mitigation policies (ProcessImageLoadPolicy PreferSystem32Images=1) to prevent
# DLL sideloading. See packages/insomnia-inso/src/cpp/ for the wrapper source.

set -e

VERSION=$(jq .version ./packages/insomnia-inso/package.json -rj)
echo "Starting inso secure wrapper build for version $VERSION..."
MAJOR=$(echo $VERSION | cut -d '.' -f 1)
MINOR=$(echo $VERSION | cut -d '.' -f 2)
PATCH=$(echo $VERSION | cut -d '.' -f 3 | cut -d '-' -f 1)
TAG=$(echo $VERSION | cut -d '-' -f 2)
CPP_DIR=packages/insomnia-inso/src/cpp
BINARIES_DIR=packages/insomnia-inso/binaries

if [ -n "$TAG" ]; then
  TAG="-$TAG"
fi

# Rename the pkg-built binary so the wrapper can take the inso.exe name.
echo "Renaming inso.exe to inso-node.exe..."
mv $BINARIES_DIR/inso.exe $BINARIES_DIR/inso-node.dll

echo "Injecting version strings..."
sed "s/__MAJOR__/$MAJOR/g" $CPP_DIR/resources.rc > $CPP_DIR/final.rc
sed -i "s/__MINOR__/$MINOR/g" $CPP_DIR/final.rc
sed -i "s/__PATCH__/$PATCH/g" $CPP_DIR/final.rc
sed -i "s/__TAG__/$TAG/g" $CPP_DIR/final.rc
sed -i "s/__YEAR__/$(date +%Y)/g" $CPP_DIR/final.rc

echo "Compiling resources..."
windres $CPP_DIR/final.rc $CPP_DIR/res.o

echo "Compiling inso wrapper..."
# Note: no -mwindows flag — inso is a console application.
g++ -lkernel32 -c $CPP_DIR/inso.cpp -o $CPP_DIR/inso.o

echo "Linking inso wrapper..."
g++ -O2 -static -static-libgcc -static-libstdc++ -lwinpthread \
    $CPP_DIR/inso.o $CPP_DIR/res.o -o $BINARIES_DIR/inso.exe

echo "Inso secure wrapper built successfully."
