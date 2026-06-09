const { spawnSync } = require('node:child_process');
const path = require('node:path');

const binary = path.resolve('binaries/inso');
const lintFixture = path.resolve('src/commands/fixtures/openapi-spec.yaml');
const env = { ...process.env };
delete env.CI;

const commands = [['--help'], ['lint', 'spec', lintFixture]];

for (const args of commands) {
  const result = spawnSync(binary, args, { env, encoding: 'utf8' });

  if (result.error) {
    console.error(`Failed to run ${binary} ${args.join(' ')}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Command failed (exit ${result.status}): ${binary} ${args.join(' ')}`);
    if (result.stdout) {
      console.error(result.stdout);
    }
    if (result.stderr) {
      console.error(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
}

console.log('Packaged binary smoke tests passed');
