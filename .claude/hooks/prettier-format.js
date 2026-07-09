#!/usr/bin/env node
// PostToolUse hook (Write|Edit): formats the touched file with the repo's local Prettier.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = input.tool_response?.filePath || input.tool_input?.file_path;
if (!filePath || !fs.existsSync(filePath)) {
  process.exit(0);
}

const repoRoot = path.join(__dirname, '..', '..');
const prettierCli = path.join(repoRoot, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

try {
  execFileSync(process.execPath, [prettierCli, '--ignore-unknown', '--write', filePath], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
} catch {
  // Ignore formatting failures (e.g. syntax errors) so the hook never blocks the agent.
}
