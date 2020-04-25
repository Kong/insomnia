#!/bin/sh

# Fail on any errors
set -e

if [ -z "$GITHUB_WORKSPACE" ]; then
  echo "Set the GITHUB_WORKSPACE env variable."
  exit 1
fi

# Install root project dependencies
cd "$GITHUB_WORKSPACE"
npm run bootstrap

echo "Running the stuff"
npm test
npm run app-release