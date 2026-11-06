const { exec } = require('child_process');
const fs = require('fs');
const util = require('util');
const path = require('path');
const execAsync = util.promisify(exec);

// Every signed file costs one code-signing token. List the files in the GitHub job summary,
// so the number of tokens used by a release build is visible. Never fails the signing.
function recordSignedFile(file) {
  const { GITHUB_STEP_SUMMARY } = process.env;
  if (!GITHUB_STEP_SUMMARY) {
    return;
  }
  try {
    fs.appendFileSync(GITHUB_STEP_SUMMARY, `- signed (customSign): \`${path.basename(file)}\`\n`);
  } catch (error) {
    console.log('[customSign] Could not write to the job summary:', error.message);
  }
}

// adapted from https://www.electron.build/win.html#how-do-delegate-code-signing
// It was possible code-sign installer after packaging, but some files are only available
// through hooking into the signing step of electron-builder while the final installer is being built
// This makes it possible to sign the Update.exe and stub of Insomnia.exe that end up in the installation folder
exports.default = async function (configuration) {
  if (configuration.options.target.length === 0) {
    console.log('[customSign] Skipping signing because target is empty');
    return;
  }

  const { SM_KEYPAIR_ALIAS, SM_API_KEY, SM_CLIENT_CERT_PASSWORD } = process.env;
  if (!SM_KEYPAIR_ALIAS || !SM_API_KEY || !SM_CLIENT_CERT_PASSWORD) {
    const missing = Object.entries({ SM_KEYPAIR_ALIAS, SM_API_KEY, SM_CLIENT_CERT_PASSWORD })
      .filter(([, value]) => !value)
      .map(([name]) => name);
    console.log(`[customSign] Skipping signing, missing required environment variable(s): ${missing.join(', ')}`);
    return;
  }

  // Note: Avoid changing the lines below. Risk of breaking the windows code-signing process.
  // Feedback loop > 15 mins. Requires a branch on origin, a PR, and a separate dummy release pipeline to test changes.
  const rawPath = configuration.path.replace(/(\r\n|\n|\r)/gm, ''); // remove /n and other crap from path
  console.log('[customSign] File to sign before final packaging:', rawPath);
  const absolutePath = path.resolve(rawPath); // C:\Users\...\Update.exe
  const fixedAbsolutePath = absolutePath.replace(/\\/g, '/'); // C:/Users/.../Update.exe
  const smctlSignCommand = `smctl sign --simple --keypair-alias ${SM_KEYPAIR_ALIAS} --input ${fixedAbsolutePath}`;

  try {
    console.log('[customSign] Starting to run smctl sign cmd...');
    const { stdout, stderr } = await execAsync(smctlSignCommand);

    console.log('[customSign] smctl sign command output:', stdout);
    if (stderr) {
      console.error('[customSign] smctl sign command error output:', stderr);
    }

    console.log('[customSign] File signed successfully.');
    recordSignedFile(fixedAbsolutePath);
  } catch (error) {
    console.error('[customSign] Error executing smctl sign command:', error);
    throw error;
  }
};
