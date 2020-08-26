const fs = require('fs');

const foundNodeVersion = process.versions.node;
const expectedNodeVersion = '12.8.0';
const fromFile = fs
  .readFileSync('.nvmrc')
  .toString()
  .trim();

if (foundNodeVersion !== expectedNodeVersion) {
  console.log(`Current node version: ${foundNodeVersion}`);
  console.log(`Expected node version: ${expectedNodeVersion}`);
  console.log(
    `Remember to 'npm run clean && npm run bootstrap' after installing the expected version.`,
  );
  console.log();
  process.exit(1);
}
