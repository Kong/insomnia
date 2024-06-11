#!/usr/bin/bash

# To test locally, set ARTIFACT_PATH="packages" CLI_ARTIFACT_SHAFILE=cli.sha256 ELECTRON_ARTIFACT_SHAFILE=electron.sha256  ./.github/scripts/generate-binary-digest.sh
set -euo pipefail
echo "CLI FILES FOUND"
cli_files=$(find "${ARTIFACT_PATH}" -type f \( -name "inso-*.zip" -o -name "inso-*.pkg" -o -name "inso-*.tar.xz" \) -exec sha256sum {} \;)
echo "${cli_files}"
echo "CLI FILES WITH PATH STRIPPED"
echo "${cli_files}" | sed "s/\(.* \)\(.*\(inso\)\)/\1\\3/" | sort > "${CLI_ARTIFACT_SHAFILE}"
cat "${CLI_ARTIFACT_SHAFILE}"
echo "ELECTRON APP FILES FOUND"
app_files=$(find "${ARTIFACT_PATH}" -type f \( -name "Insomnia.Core-*" \)  -exec sha256sum {} \;)
echo "${app_files}"
echo "ELECTRON APP FILES WITH PATH STRIPPED"
echo "${app_files}" | sed "s/\(.* \)\(.*\(Insomnia.Core\)\)/\1\\3/" | sort > "${ELECTRON_ARTIFACT_SHAFILE}"
cat "${ELECTRON_ARTIFACT_SHAFILE}"

if [[ -z "$(cat ${CLI_ARTIFACT_SHAFILE})" ]]; then
    echo "CLI Artifacts SHA256 Digest file generation failed"
    exit 1
else
    echo "CLI ARTIFACT BASE64 DIGEST"
    base64 -w0 "${CLI_ARTIFACT_SHAFILE}" > "${CLI_ARTIFACT_BASE64_FILE}"
fi

if [[ -z "$(cat ${ELECTRON_ARTIFACT_SHAFILE})" ]]; then
    echo "ELECTRON Artifacts SHA256 Digest file generation failed"
    exit 1
else
    echo "ELECTRON APP FILE DIGEST"
    base64 -w0 "${ELECTRON_ARTIFACT_SHAFILE}" > "${ELECTRON_ARTIFACT_BASE64_FILE}"
fi