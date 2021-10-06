# Based on https://localazy.com/blog/how-to-automatically-sign-macos-apps-using-github-actions and https://stackoverflow.com/a/60807932

# Create temporary keychain
KEYCHAIN="inso.keychain"
KEYCHAIN_PASSWORD="inso"
security create-keychain -p $KEYCHAIN_PASSWORD $KEYCHAIN
security default-keychain -s $KEYCHAIN

# Unlock the keychain
security set-keychain-settings $KEYCHAIN
security unlock-keychain -p $KEYCHAIN_PASSWORD $KEYCHAIN

# Unlock the keychain
security unlock-keychain -p $KEYCHAIN_PASSWORD $KEYCHAIN

# Import certificate
echo $MACOS_CERTIFICATE_LINK | base64 --decode > certificate.p12
security import certificate.p12 -k $KEYCHAIN -P $MACOS_CERTIFICATE_PWD -T /usr/bin/codesign -T /usr/bin/productbuild

# Detect the identity
IDENTITY=$(security find-identity -v -p codesigning $KEYCHAIN | head -1 | grep '"' | sed -e 's/[^"]*"//' -e 's/".*//')

# New requirement for MacOS 10.12+
security set-key-partition-list -S apple-tool:,apple:,codesign:,productbuild: -s -k $KEYCHAIN_PASSWORD $KEYCHAIN

# Based on from https://developer.apple.com/forums/thread/128166
# Sign the app
/usr/bin/codesign --force -s $IDENTITY binaries/inso

# Based on https://developer.apple.com/forums/thread/128166
# Create and sign the package
mkdir compressed
productbuild --sign $IDENTITY --component binaries/inso /Applications compressed/$PKG_NAME

# # Based on https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/customizing_the_notarization_workflow
# # Notarise
# xcrun notarytool submit compressed/$PKG_NAME --apple-id $APPLE_ID --password $APPLE_ID_PASSWORD --team-id TODO --wait

# # Based on https://developer.apple.com/forums/thread/128166
# # Staple
# xcrun stapler staple compressed/$PKG_NAME
