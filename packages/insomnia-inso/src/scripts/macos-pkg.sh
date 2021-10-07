# Based on https://localazy.com/blog/how-to-automatically-sign-macos-apps-using-github-actions and https://stackoverflow.com/a/60807932

# Create temporary keychain
KEYCHAIN="inso.keychain"
KEYCHAIN_PASSWORD="inso"
BUNDLE_ID="com.insomnia.inso.app"
security create-keychain -p $KEYCHAIN_PASSWORD $KEYCHAIN
security default-keychain -s $KEYCHAIN

# Unlock the keychain
security set-keychain-settings $KEYCHAIN
security unlock-keychain -p $KEYCHAIN_PASSWORD $KEYCHAIN

# Import certificate
echo $MACOS_CERTIFICATE_LINK | base64 --decode > certificate.p12
security import certificate.p12 -k $KEYCHAIN -P $MACOS_CERTIFICATE_PWD -T /usr/bin/codesign -T /usr/bin/pkgbuild

# Detect the identity
# APP_IDENTITY=$(security find-identity -v $KEYCHAIN | grep 'Application' | sed -e 's/[^"]*"//' -e 's/".*//')
APP_IDENTITY="Developer ID Application: Kong Inc. (FX44YY62GV)"
INSTALL_IDENTITY="Developer ID Installer: Kong Inc. (FX44YY62GV)"

# New requirement for MacOS 10.12+
security set-key-partition-list -S apple-tool:,apple:,codesign:,pkgbuild: -s -k $KEYCHAIN_PASSWORD $KEYCHAIN

# Create a staging area for the installer package.
mkdir -p macos-installer/bin

# Copy the binary into the staging area.
cp binaries/inso macos-installer/bin

# Based on https://developer.apple.com/forums/thread/128166
# Based on https://developer.apple.com/forums/thread/669188
# Sign the binary
ENTITLEMENTS_PATH="src/scripts/codesign.entitlements"
plutil -lint $ENTITLEMENTS_PATH
/usr/bin/codesign --force --options=runtime --entitlements $ENTITLEMENTS_PATH -s "$APP_IDENTITY" macos-installer/bin/inso

# Based on https://developer.apple.com/forums/thread/128166
# Build the package
mkdir compressed
pkgbuild --identifier $BUNDLE_ID --version $VERSION --sign "$INSTALL_IDENTITY" --keychain $KEYCHAIN --timestamp --root macos-installer/bin --install-location /usr/local/bin compressed/$PKG_NAME

# # # Based on https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow
# # # Notarise
# xcrun notarytool submit compressed/$PKG_NAME --apple-id $APPLE_ID --password $APPLE_ID_PASSWORD --wait

# # # Based on https://developer.apple.com/forums/thread/128166
# # # Staple
# xcrun stapler staple compressed/$PKG_NAME
