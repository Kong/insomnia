#!/usr/bin/env bash
# Updates the AUR package to a released version. Usage: publish.sh <version>
# Needs makepkg, and an SSH key registered with the AUR.
set -euo pipefail

version="$1"
package=restless-bin
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

git clone "ssh://aur@aur.archlinux.org/${package}.git" "$work_dir/aur"
cp "$source_dir/PKGBUILD" "$source_dir/restless.desktop" "$work_dir/aur/"
cd "$work_dir/aur"

sed -i "s/^pkgver=.*/pkgver=${version}/; s/^pkgrel=.*/pkgrel=1/" PKGBUILD
updpkgsums
makepkg --printsrcinfo > .SRCINFO

git add PKGBUILD restless.desktop .SRCINFO
if git diff --cached --quiet; then
  echo "AUR already at ${version}"
  exit 0
fi
git commit -m "Update to ${version}"
git push origin HEAD:master
