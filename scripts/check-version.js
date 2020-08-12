const fs = require('fs');

const foundNodeVersion = process.versions.node;
const expectedNodeVersion = fs
  .readFileSync('.nvmrc')
  .toString()
  .trim();

if (foundNodeVersion !== expectedNodeVersion) {
  console.log(`Current node version: ${foundNodeVersion}`);
  console.log(`Expect node version: ${expectedNodeVersion}`);
  console.log(
    `Remember to 'npm run clean && npm run bootstrap' after installing the expected version.`,
  );
  console.log();
  process.exit(1);
}
