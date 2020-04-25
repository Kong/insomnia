#!/bin/sh

# Fail on any errors
set -e

if [ -z "$GITHUB_WORKSPACE" ]; then
  echo "Set the GITHUB_WORKSPACE env variable."
  exit 1
fi

# Install root project dependencies
echo "Bootstrapping dependencies"
whoami
ls -l
cd "$GITHUB_WORKSPACE"
npm run bootstrap

echo "Running tests"
npm test

echo "Releasing the app"
npm run app-release