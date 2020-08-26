const fs = require('fs');

const GREEN_FG = '\x1b[32m';
const RED_FG = '\x1b[31m';
const UNDERSCORE = '\x1b[4m';
const BRIGHT = '\x1b[1m';
const RESET = '\x1b[0m';

const foundNodeVersion = process.versions.node;
const expectedNodeVersion = fs
  .readFileSync('.nvmrc')
  .toString()
  .trim();

console.log('Checking the current node version ...\n');
if (foundNodeVersion !== expectedNodeVersion) {
  console.log(`Current node version -> ${RED_FG}${foundNodeVersion}${RESET}`);
  console.log(`Expected node version -> ${GREEN_FG}${expectedNodeVersion}${RESET}`);
  console.log();
  console.log(
    `One solution to manage multiple versions of node is nvm, visit ${UNDERSCORE}https://github.com/nvm-sh/nvm${RESET}`,
  );
  console.log();
  console.log(
    `${BRIGHT}Remember to 'npm run clean && npm run bootstrap' after installing the expected version.${RESET}`,
  );
  console.log();
  process.exit(1);
}
