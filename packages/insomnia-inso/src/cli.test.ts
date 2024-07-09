import { describe, expect, it } from '@jest/globals';
import { exec, ExecException } from 'child_process';
import path from 'path';

// dev experience
// goals: it should be quick and run in  ci and should be easy to debug
// ideas: create a second test.yml easier to reason about the state of node-libcurl it can parallel

// issues: no immeidate feedback as the test is running
//               run the test, do you need to know about the libcurl thing or should i be automated?

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
describe('inso dev bundle', () => {
  it.each(shouldReturnSuccessCode)('exit code should be 0: %p', async input => {
    const result = await cli(input);
    if (result.code !== 0) {
      console.log(result.stderr);
    }
    expect(result.code).toBe(0);
  });
  it.each(shouldReturnErrorCode)('exit code should be 1: %p', async input => {
    const result = await cli(input);
    if (result.code !== 1) {
      console.log(result.stdout);
    }
    expect(result.code).toBe(1);
  });
});

const packagedSuccessCodes = shouldReturnSuccessCode.map(x => x.replace('$PWD/packages/insomnia-inso/bin/inso', '$PWD/packages/insomnia-inso/binaries/inso'));
const packagedErrorCodes = shouldReturnErrorCode.map(x => x.replace('$PWD/packages/insomnia-inso/bin/inso', '$PWD/packages/insomnia-inso/binaries/inso'));

describe('inso packaged binary', () => {
  it.each(packagedSuccessCodes)('exit code should be 0: %p', async input => {
    const result = await cli(input);
    if (result.code !== 0) {
      console.log(result.stderr);
    }
    expect(result.code).toBe(0);
  });
  it.each(packagedErrorCodes)('exit code should be 1: %p', async input => {
    const result = await cli(input);
    if (result.code !== 1) {
      console.log(result.stdout);
    }
    expect(result.code).toBe(1);
  });
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
