import { exec } from 'child_process';
import path from 'path';

// should be each to copy and run in local js debug terminal
// and also print which one fails when running all tests
// TODO: move all fixtures to the same folder, and name valid or invalid or whatever
const shouldReturnSuccessCode = [
  '$PWD/packages/insomnia-inso/bin/inso -h',
  // from db
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',
  // identifier filepath
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/commands/fixtures/with-ruleset/path-plugin.yaml',
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/commands/fixtures/openapi-spec.yaml',
  // from db
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',
];
test.each(shouldReturnSuccessCode)('Code should be 0: %p', async input => {
  const result = await cli(input);
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
