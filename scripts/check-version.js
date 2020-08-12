const foundNodeVersion = process.versions.node;
const expectedNodeVersion = process.argv[3];

if (foundNodeVersion !== expectedNodeVersion) {
  console.log(`Current node version: ${foundNodeVersion}`);
  console.log(`Expect node version: ${expectedNodeVersion}`);
  console.log(
    `Remember to 'npm run clean && npm run bootstrap' after installing the expected version.`,
  );
  console.log();
  process.exit(1);
}
