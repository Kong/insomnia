import { describe, expect, it } from '@jest/globals';
import { exec, ExecException } from 'child_process';
import path from 'path';

const shouldReturnSuccessCode = [
  // help
  '$PWD/packages/insomnia-inso/bin/inso -h',

  // lint spec
  // as identifer filepath
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/commands/fixtures/openapi-spec.yaml',
  // as identifier filepath with spectral.yaml
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/commands/fixtures/with-ruleset/path-plugin.yaml',
  // as working directory and identifier filename
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/commands/fixtures/with-ruleset path-plugin.yaml',
  // as working directory containing nedb
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',
  // export spec nedb, git-repo, export file
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso export spec -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',

  // run test
  // nedb, gitrepo, export file
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/nedb -e env_env_ca046a uts_fe901c',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/nedb -e env_env_ca046a --reporter min uts_fe901c',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/git-repo -e env_env_ca046a uts_fe901c',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/insomnia-v4/insomnia_v4.yaml -e env_env_0e4670 spc_3b2850',
  // export file,request can inherit auth headers and variables from folder
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/examples/folder-inheritance-document.yml spc_a8144e --verbose',

  // run collection
  // export file
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-smoke-test/fixtures/simple.yaml -e env_2eecf85b7f wrk_0702a5',
  // with regex filter
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-smoke-test/fixtures/simple.yaml -e env_2eecf85b7f --requestNamePattern "example http" wrk_0702a5',
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
      console.log(result);
    }
    expect(result.code).toBe(0);
  });
  it.each(shouldReturnErrorCode)('exit code should be 1: %p', async input => {
    const result = await cli(input);
    if (result.code !== 1) {
      console.log(result);
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
      console.log(result);
    }
    expect(result.code).toBe(0);
  });
  it.each(packagedErrorCodes)('exit code should be 1: %p', async input => {
    const result = await cli(input);
    if (result.code !== 1) {
      console.log(result);
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
