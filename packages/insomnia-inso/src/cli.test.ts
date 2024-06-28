import { exec } from 'child_process';
import path from 'path';

const shouldReturnSuccessCode = [
  '$PWD/packages/insomnia-inso/bin/inso -h',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/commands/fixtures/with-ruleset/path-plugin.yaml',
];

test('Code should be 0', async () => {
  const result = await cli(shouldReturnSuccessCode[0]);
  expect(result.code).toBe(0);
});

function cli(input) {
  return new Promise(resolve => {
    exec(input,
      {
        cwd: path.resolve(__dirname, '../../..'),
      },
      (error, stdout, stderr) => {
        resolve({
          code: error && error.code ? error.code : 0,
          error,
          stdout,
          stderr,
        });
      });
  });
}
