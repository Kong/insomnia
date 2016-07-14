#!/bin/bash
#? Package the app

APP_NAME="Insomnia"
APP_ID="com.insomnia.app"
APP_VERSION=$(node -e "console.log(require('./dist/package.json').version)")
COMPANY_NAME="Gregory Schier"
OUT_DIR="build/darwin/v$APP_VERSION"

echo "-- PACKAGING v$APP_VERSION TO $OUT_DIR/... --"

node -r babel-register node_modules/electron-packager/cli.js \
    dist \
    "$APP_NAME" \
    --platform=darwin \
    --arch=x64 \
    --asar \
    --app-version="$APP_VERSION" \
    --version-string.CompanyName="$COMPANY_NAME" \
    --version-string.ProductName="$APP_NAME" \
    --version-string.FileDescription="Beautiful HTTP Client" \
    --version-string.OriginalFilename="$APP_ID" \
    --version-string.InternalName="$APP_ID" \
    --download.strictSSL=true \
    --icon=assets/icon \
    --out="$OUT_DIR" \
    --app-bundle-id="$APP_ID" \
    --app-category-type='public.app-category.developer-tools' \
    --sign='Developer ID Application: Gregory Schier (7PU3P6ELJ8)' \
    --osx-sign \
    --overwrite

cd "$OUT_DIR"
DARWIN_DIR="$APP_NAME-darwin-x64"
ZIP_NAME="$APP_NAME-v$APP_VERSION.zip"

mv "$DARWIN_DIR/$APP_NAME.app" "./$APP_NAME.app"
rm -r "$DARWIN_DIR"

zip -rqyX9 "$ZIP_NAME" "$APP_NAME.app"
rm -r "$APP_NAME.app"

echo "-- PACKAGED $APP_VERSION TO $OUT_DIR --"
