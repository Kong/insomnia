const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

exports.default = async function(configuration) {
    console.log('[customSign] Debug - file to sign before packaging:', configuration.path);
    const { USERNAME, PASSWORD, CREDENTIAL_ID, TOTP_SECRET } = process.env;

    if (!USERNAME || !PASSWORD || !CREDENTIAL_ID || !TOTP_SECRET) {
        throw new Error('[customSign] Missing required environment variables.');
    }
    // meant to be run on Windows host with docker
    const inputFilePath = configuration.path.replace(/\\/g, '/');
    const dockerCommand = `docker run --rm \
        -e USERNAME="${USERNAME}" \
        -e PASSWORD="${PASSWORD}" \
        -e CREDENTIAL_ID="${CREDENTIAL_ID}" \
        -e TOTP_SECRET="${TOTP_SECRET}" \
        ghcr.io/sslcom/codesigner-win:latest sign \
        -input_file_path="${inputFilePath}" -override`;
    try {
        const { stdout, stderr } = await execAsync(dockerCommand);

        console.log('[customSign] Docker command output:', stdout);
        if (stderr) {
            console.error('[customSign] Docker command error output:', stderr);
        }

        console.log('[customSign] File signed successfully.');
    } catch (error) {
        console.error('[customSign] Error executing Docker command:', error);
        throw error;
    }
};
