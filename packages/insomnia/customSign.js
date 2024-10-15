const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execAsync = util.promisify(exec);

exports.default = async function(configuration) {
    // skip signing if not windows squirrel
    if (!configuration.options.target || configuration.options.target !== 'squirrel' || configuration.options.target[0].target !== 'squirrel') {
        console.log('[customSign] Skipping signing because target is not windows squirrel.');
        return;
    }
    // remove /n and other crap from path
    const rawPath = configuration.path.replace(/(\r\n|\n|\r)/gm, '');
    console.log('[customSign] File to sign before final packaging:', rawPath);

    const { USERNAME, PASSWORD, CREDENTIAL_ID, TOTP_SECRET } = process.env;

    if (!USERNAME || !PASSWORD || !CREDENTIAL_ID || !TOTP_SECRET) {
        throw new Error('[customSign] Missing required environment variables.');
    }
    // meant to be run on Windows host with docker
    const absolutePath = path.resolve(rawPath);
    const inputFileName = path.basename(absolutePath);
    // Convert Windows path to Unix-style path for Docker
    const dockerInputFilePath = path.posix.join('/data', inputFileName);
    const dockerCommand = `docker run --rm \
        -v "${absolutePath.replace(/\\/g, '/')}:${path.posix.join('/data', inputFileName)}" \
        -e USERNAME="${USERNAME}" \
        -e PASSWORD="${PASSWORD}" \
        -e CREDENTIAL_ID="${CREDENTIAL_ID}" \
        -e TOTP_SECRET="${TOTP_SECRET}" \
        ghcr.io/sslcom/codesigner:latest sign \
        -input_file_path="${dockerInputFilePath}" -override`;

    try {
        console.log('[customSign] Docker command:', dockerCommand);
        console.log('[customSign] Starting to run sign cmd via docker...');
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
