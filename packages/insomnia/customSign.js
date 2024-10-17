const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execAsync = util.promisify(exec);

// adapted from https://www.electron.build/win.html#how-do-delegate-code-signing
// It was possible code-sign installer after packaging, but some files are only available
// through hooking into the signing step of electron-builder while the final squirrel installer is being built
// This makes it possible to sign the Update.exe and stub of Insomnia.exe that end up in C:\Users\<user>\AppData\Local\insomnia
exports.default = async function(configuration) {
    // skip signing if not windows squirrel
    if (configuration.options.target.length === 0 || configuration.options.target[0].target !== 'squirrel') {
        console.log('[customSign] Skipping signing because target is not windows squirrel.');
        return;
    }

    const { USERNAME, PASSWORD, CREDENTIAL_ID, TOTP_SECRET } = process.env;
    if (!USERNAME || !PASSWORD || !CREDENTIAL_ID || !TOTP_SECRET) {
        console.log('[customSign] Skipping signing,  Missing required environment variables.');
        return;
    }

    // Note: Avoid changing the lines bellow. Risk of breaking the windows code-signing process.
    // Feedback loop > 15 mins. Requires a branch on origin, a PR, and a separate dummy release pipeline to test changes.
    // sslcom/codesigner-win has large image size (>1GB) and requires docker within windows-latest host.
    const rawPath = configuration.path.replace(/(\r\n|\n|\r)/gm, ''); // remove /n and other crap from path
    console.log('[customSign] File to sign before final packaging:', rawPath);
    const absolutePath = path.resolve(rawPath); // C:\Users\...\Update.exe
    const fixedAbsolutePath = absolutePath.replace(/\\/g, '/'); // C:/Users/.../Update.exe
    const lastSlashIndex = fixedAbsolutePath.lastIndexOf('/'); // index of last / slash
    const directoryPath = fixedAbsolutePath.substring(0, lastSlashIndex); // C:/Users/...
    const inputFileName = path.basename(absolutePath); // Update.exe
    const codeSignPath = 'C:/CodeSignTool/Insomnia'; // path inside docker container
    const dockerInputFilePath = path.join(codeSignPath, inputFileName); // C:/CodeSignTool/Insomnia/Update.exe
    const dockerCommand = `docker run --rm \
        -v "${directoryPath}:${codeSignPath}" \
        -e USERNAME="${USERNAME}" \
        -e PASSWORD="${PASSWORD}" \
        -e CREDENTIAL_ID="${CREDENTIAL_ID}" \
        -e TOTP_SECRET="${TOTP_SECRET}" \
        ghcr.io/sslcom/codesigner-win:latest sign \
        \`\`-input_file_path="${dockerInputFilePath}" \`\`-override`;

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
