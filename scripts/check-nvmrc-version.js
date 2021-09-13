// TODO(TSCONVERSION) convert to TypeScript and update package.json to use ts-node
const fs = require('fs');
const path = require('path');

const GREEN_FG = '\x1b[32m';
const RED_FG = '\x1b[31m';
const YELLOW_FG = '\x1b[33m';
const BRIGHT = '\x1b[1m';
const RESET = '\x1b[0m';

const engines = enginesFromPackage();
const expectedNodeVersion = engines.node;
const foundNvmrcNodeVersion = fs.readFileSync('.nvmrc').toString().trim();

if (foundNvmrcNodeVersion !== expectedNodeVersion) {
  console.log(
    `${BRIGHT}${RED_FG}Incorrect node version specified in .nvmrc ...${RESET}\n`
  );
  console.log(
    `Current .nvmrc node version -> ${RED_FG}${foundNvmrcNodeVersion}${RESET}`
  );
  console.log(
    `Expected node version from package.json engines -> ${GREEN_FG}${expectedNodeVersion}${RESET}`
  );
  console.log();
  console.log(`Update .nvmrc to match package.json engines node version`);
  console.log();
  console.log(
    `${BRIGHT}${YELLOW_FG}Remember to 'npm run clean && npm run bootstrap' after installing the expected version.${RESET}`
  );
  console.log();
  process.exit(1);
}

function enginesFromPackage() {
  let packageJson;

  try {
    packageJson = require(path.join(process.cwd(), 'package.json'));
  } catch (e) {
    console.log(
      'Error: A package.json file is expected in the current working directory'
    );
    console.log('Current working directory is: ' + process.cwd());

    process.exit(1);
  }

  if (!packageJson.engines) {
    console.log(
      'Error: The package.json is expected to contain the "engines" key'
    );
    console.log(
      'See https://docs.npmjs.com/files/package.json#engines for the supported syntax'
    );

    process.exit(1);
  }

  return ['node', 'npm'].reduce(
    (memo, name) => ({
      ...memo,
      [name]: packageJson.engines[name],
    }),
    {}
  );
}
