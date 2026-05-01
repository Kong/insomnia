#!/usr/bin/env bash
# Run once after cloning: bash scripts/setup.sh
set -euo pipefail

echo "Configuring local git settings..."
git config --local log.abbrevCommit true
git config --local log.decorate false
git config --local status.short true
git config --local diff.stat true

echo ""
echo "Optional shell aliases (add to ~/.zshrc manually):"
echo '  alias gl="git log --oneline --no-merges -20"'
echo '  alias gs="git status -s"'
