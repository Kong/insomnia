// const fs = require('fs');

const foundNodeVersion = process.versions.node;
// const expectedNodeVersion = fs
//   .readFileSync('.nvmrc')
//   .toString()
//   .trim();

if (foundNodeVersion !== '12.8.0') {
  console.log(`Current node version: ${foundNodeVersion}`);
  console.log(`Expected node version: ${expectedNodeVersion}`);
  console.log(
    `Remember to 'npm run clean && npm run bootstrap' after installing the expected version.`,
  );
  console.log();
  process.exit(1);
}
