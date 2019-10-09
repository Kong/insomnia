#!/bin/sh

# Fail on any errors
set -e

echo "Running the stuff"
npm test
npm run app-package