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
security import certificate.p12 -k $KEYCHAIN -P $MACOS_CERTIFICATE_PWD -T /usr/bin/codesign

# Detect the identity
IDENTITY=$(security find-identity -v -p codesigning $KEYCHAIN | head -1 | grep '"' | sed -e 's/[^"]*"//' -e 's/".*//')

# New requirement for MacOS 10.12+
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k $KEYCHAIN_PASSWORD $KEYCHAIN

# Build and sign
productbuild --sign $IDENTITY --component packages/insomnia-inso/binaries/inso /Applications packages/insomnia-inso/compressed
