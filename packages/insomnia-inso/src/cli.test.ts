import { expect, test } from '@jest/globals';
import { exec, ExecException } from 'child_process';
import path from 'path';

// should be each to copy and run in local js debug terminal
// and also print which one fails when running all tests
// TODO: move all fixtures to the same folder, and name valid or invalid or whatever
const shouldReturnSuccessCode = [
  '$PWD/packages/insomnia-inso/bin/inso -h',
  // identifier filepath
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/commands/fixtures/openapi-spec.yaml',
  // identifier filepath with spectral.yaml
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/commands/fixtures/with-ruleset/path-plugin.yaml',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/commands/fixtures/with-ruleset path-plugin.yaml',
  // lint from db
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',
  // export from db
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',
  // test from db
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/nedb -e env_env_ca046a uts_fe901c',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/nedb -e env_env_ca046a --reporter min uts_fe901c',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/git-repo -e env_env_ca046a uts_fe901c',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml -e env_env_0e4670 spc_3b2850',
  // workspace - request from db
  // '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml -e env_env_0e4670 --requestNamePattern "Example 1" wrk_8ee1e0',
  // TODO: request group - request from db, add simple export file pointing at local server
  // TODO: add bail option
];

const shouldReturnErrorCode = [
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/nedb -e env_env_ca046a uts_7f0f85',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/git-repo -e env_env_ca046a uts_7f0f85',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/git-repo-malformed-spec spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/db/fixtures/insomnia-v4/malformed.yaml',
];
test.each(shouldReturnSuccessCode)('Code should be 0: %p', async input => {
  const result = await cli(input);
  expect(result.code).toBe(0);
});

test.each(shouldReturnErrorCode)('Code should be 1: %p', async input => {
  const result = await cli(input);
  expect(result.code).toBe(1);
});

const cli = (input: string): Promise<{ code: number; error: ExecException | null; stdout: string; stderr: string }> => {
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
};
