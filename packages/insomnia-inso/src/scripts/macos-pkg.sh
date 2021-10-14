# Useful resources for the creation of this script
# https://developer.apple.com/forums/thread/128166
# https://developer.apple.com/forums/thread/669188
# https://localazy.com/blog/how-to-automatically-sign-macos-apps-using-github-actions
# https://stackoverflow.com/a/60807932
# https://stackoverflow.com/a/55074083

# Environment variables to be set by caller
# MACOS_CERTIFICATE (installer and application certificate combined and base64 enoded)
# MACOS_CERTIFICATE_PWD
# PKG_NAME
# VERSION
# BUNDLE_ID

# Assumed current working directory is packages/insomnia-inso

# Some constants
APP_IDENTITY="Developer ID Application: Kong Inc. (FX44YY62GV)"
INSTALL_IDENTITY="Developer ID Installer: Kong Inc. (FX44YY62GV)"

ENTITLEMENTS_PATH="src/scripts/codesign.entitlements"

STAGING_AREA="macos-installer/bin"
SOURCE_BINARY_DIR="binaries"
ARTIFACT_LOCATION="artifacts"
SOURCE_BINARY_NAME="inso"
INSTALL_LOCATION="/usr/local/bin"
KEYCHAIN="inso.keychain"
KEYCHAIN_PASSWORD="inso"

# Create temporary keychain
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security default-keychain -s "$KEYCHAIN"

# Unlock the keychain
security set-keychain-settings "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"

# Import certificate
echo $MACOS_CERTIFICATE | base64 --decode > certificate.p12
security import certificate.p12 -k "$KEYCHAIN" -P "$MACOS_CERTIFICATE_PWD" -T /usr/bin/codesign -T /usr/bin/pkgbuild

# New requirement for MacOS 10.12+
security set-key-partition-list -S apple-tool:,apple:,codesign:,pkgbuild: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN"

# Sign the binary
plutil -lint "$ENTITLEMENTS_PATH"
/usr/bin/codesign --force --options=runtime --entitlements "$ENTITLEMENTS_PATH" --timestamp --sign "$APP_IDENTITY" "$SOURCE_BINARY_DIR/$SOURCE_BINARY_NAME"

# Create a staging area for the installer package.
mkdir -p "$STAGING_AREA"

# Copy the binary into the staging area.
cp "$SOURCE_BINARY_DIR/$SOURCE_BINARY_NAME" "$STAGING_AREA"

# Build and sign the package
mkdir $ARTIFACT_LOCATION
/usr/bin/pkgbuild --identifier "$BUNDLE_ID" --version "$VERSION" --sign "$INSTALL_IDENTITY" --keychain "$KEYCHAIN" --timestamp --root "$STAGING_AREA" --install-location "$INSTALL_LOCATION" "$ARTIFACT_LOCATION/$PKG_NAME.pkg"
