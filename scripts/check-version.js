// TODO(TSCONVERSION) convert to TypeScript and update package.json to use ts-node
const fs = require('fs');
const { exec } = require('child_process');

const GREEN_FG = '\x1b[32m';
const RED_FG = '\x1b[31m';
const YELLOW_FG = '\x1b[33m';
const UNDERSCORE = '\x1b[4m';
const BRIGHT = '\x1b[1m';
const RESET = '\x1b[0m';

exec('npm -v', check);

function check(error, npmVersion) {
  if (error) {
    console.error(error);
    process.exit(1);
  }

  const exit = [
    checkNodeVersion(),
    checkNpmVersion(npmVersion.toString().trim()),
  ];

  if (exit.some((e) => e === 1)) {
    console.log(
      `${BRIGHT}${YELLOW_FG}Remember to 'npm run clean && npm run bootstrap' after installing the expected version.${RESET}`
    );
    process.exit(1);
  }
}

function checkNodeVersion() {
  const foundNodeVersion = process.versions.node;
  const expectedNodeVersion = fs.readFileSync('.nvmrc').toString().trim();

  if (foundNodeVersion !== expectedNodeVersion) {
    console.log(
      `${BRIGHT}${RED_FG}Incorrect node version installed ...${RESET}\n`
    );
    console.log(`Current node version -> ${RED_FG}${foundNodeVersion}${RESET}`);
    console.log(
      `Expected node version -> ${GREEN_FG}${expectedNodeVersion}${RESET}`
    );
    console.log();
    console.log(
      `One solution to manage multiple versions of node is nvm, visit ${UNDERSCORE}https://github.com/nvm-sh/nvm${RESET}`
    );
    console.log();

    return 1;
  }
}

function checkNpmVersion(foundNpmVersion) {
  const majorVersion = parseInt(foundNpmVersion);
  if (isNaN(majorVersion)) {
    console.log(`${BRIGHT}${RED_FG}Unable to parse npm version${RESET}\n`);
    return 1;
  }

  if (majorVersion < 7) {
    console.log(
      `${BRIGHT}${RED_FG}Incorrect npm version installed ...${RESET}\n`
    );
    console.log(`Current npm version -> ${RED_FG}${foundNpmVersion}${RESET}`);
    console.log(`Expected npm version -> ${GREEN_FG}>=7.0.0${RESET}`);
    console.log();
    console.log(
      `To install npm, run ${BRIGHT}${YELLOW_FG}\`npm install -g npm@lts\`${BRIGHT}${YELLOW_FG}`
    );
    console.log();

    return 1;
  }
}
