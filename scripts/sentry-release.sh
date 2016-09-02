#!/bin/bash
#? Upload Source Maps to Sentry

APP_VERSION=$(node -e "console.log(require('./build/package.json').version)")
SENTRY_TOKEN="367a6d824c8449bfbff884f0c1bc6180"

echo "-- Creating Release $APP_VERSION --"

# ~~~~~~~~~~~~~~~~~~~~ #
# Create a new release #
# ~~~~~~~~~~~~~~~~~~~~ #

curl https://app.getsentry.com/api/0/projects/schierco/insomnia-electron/releases/ \
  -X POST \
  -u "$SENTRY_TOKEN:" \
  -H 'Content-Type: application/json' \
  -d "{\"version\": \"$APP_VERSION\"}"

echo ""
echo "-- Uploading Source Maps for $APP_VERSION --"

# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ #
# Upload files for the given release #
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ #

curl https://app.getsentry.com/api/0/projects/schierco/insomnia-electron/releases/${APP_VERSION}/files/ \
  -X POST \
  -u "$SENTRY_TOKEN:" \
  -F file=@./build/bundle.js \
  -F name="bundle.js"

curl https://app.getsentry.com/api/0/projects/schierco/insomnia-electron/releases/${APP_VERSION}/files/ \
  -X POST \
  -u "$SENTRY_TOKEN:" \
  -F file=@./build/bundle.js \
  -F name="bundle.js"

# Upload a file for the given release
curl https://app.getsentry.com/api/0/projects/schierco/insomnia-electron/releases/${APP_VERSION}/files/ \
  -X POST \
  -u "$SENTRY_TOKEN:" \
  -F file=@./build/bundle.js.map \
  -F name="bundle.js.map"

echo ""
echo "-- Done --"
