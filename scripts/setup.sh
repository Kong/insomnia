#!/usr/bin/env bash
# Run once after cloning: bash scripts/setup.sh
set -euo pipefail

echo "Configuring local git settings..."
git config --local log.abbrevCommit true
git config --local log.decorate false
git config --local status.short true
git config --local diff.stat true

