import { exec, ExecException } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';

// Tests both bundle and packaged versions of the CLI with the same commands and expectations.
// Intended to be coarse grained (only checks for success or failure) smoke test to ensure packaging worked as expected.

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
  // export file, request can inherit auth headers and variables from folder, also test --disableCertValidation with local https smoke test server
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/examples/folder-inheritance-document.yml spc_a8144e --verbose --disableCertValidation',

  // run collection
  // export file
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-smoke-test/fixtures/simple.yaml -e production wrk_dc393c',
  // with regex filter
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-smoke-test/fixtures/simple.yaml -e production --requestNamePattern "example http" wrk_dc393c',
  // after-response script and test
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/after-response.yml wrk_616795 --verbose',
  // select request by id
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/three-requests.yml -i req_3fd28aabbb18447abab1f45e6ee4bdc1 -i req_6063adcdab5b409e9b4f00f47322df4a wrk_c992d40',
  // setNextRequest runs the next request then ends
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/set-next-request.yml wrk_cbc89e',
  // multiple --env-var overrides
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/with-missing-env-vars.yml -i req_3fd28aabbb18447abab1f45e6ee4bdc1 --env-var firstkey=first --env-var secondkey=second wrk_c992d40',
  // globals file path env overrides
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/with-missing-env-vars.yml -i req_3fd28aabbb18447abab1f45e6ee4bdc1 --globals packages/insomnia-inso/src/examples/global-environment.yml wrk_c992d40',
];

const shouldReturnErrorCode = [
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/nedb -e env_env_ca046a uts_7f0f85',
  '$PWD/packages/insomnia-inso/bin/inso run test -w packages/insomnia-inso/src/db/fixtures/git-repo -e env_env_ca046a uts_7f0f85',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -w packages/insomnia-inso/src/db/fixtures/git-repo-malformed-spec spc_46c5a4',
  '$PWD/packages/insomnia-inso/bin/inso lint spec packages/insomnia-inso/src/db/fixtures/insomnia-v4/malformed.yaml',
  // after-response script and test
  '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/after-response-failed-test.yml wrk_616795 --verbose',
];

describe('inso dev bundle', () => {
  describe('exit codes are consistent', () => {
    it.each(shouldReturnSuccessCode)('exit code should be 0: %p', async input => {
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.code).toBe(0);
    });
    it.each(shouldReturnErrorCode)('exit code should be 1: %p', async input => {
      const result = await runCliFromRoot(input);
      if (result.code !== 1) {
        console.log(result);
      }
      expect(result.code).toBe(1);
    });
  });
  describe('response and timeline has scripting effects', () => {
    it('console log appears in timeline', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/minimal.yml wrk_5b5ab6 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('HTTP/1.1 200 OK');
      expect(result.stdout).toContain('Preparing request to http://127.0.0.1:4010/');
      expect(result.stdout).toContain('foo bar baz');
    });

    it('insomnia.request.addHeader works', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/script-add-header.yml wrk_5b5ab6 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('HTTP/1.1 200 OK');
      expect(result.stdout).toContain('Preparing request to http://127.0.0.1:4010/');
      expect(result.stdout).toContain('custom-test-header: test-header-value');
    });

    it('require("insomnia-collection") works', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/script-require.yml wrk_5b5ab6 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('X-Hello: hello');
      expect(result.stdout).toContain('GET /echo?k1=v1 HTTP/1.1');
    });

    it('insomnia.sendRequest works', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/script-send-request.yml wrk_cfacae --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('log: we did it: 200');
    });

    it('iterationData and iterationCount args work', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -d packages/insomnia-smoke-test/fixtures/files/runner-data.json -w packages/insomnia-inso/src/examples/three-requests.yml -n 2 -i req_3fd28aabbb18447abab1f45e6ee4bdc1 -e env_86e135 wrk_c992d40 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('expecting to see:file_value0');
      expect(result.stdout).toContain('expecting to see:file_value1');
    });

    it('send request with client cert and key', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/db/fixtures/nedb --requestNamePattern "withCertAndCA" --verbose "Insomnia Designer" wrk_0b96eff';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('Adding SSL PEM certificate');
      expect(result.stdout).toContain('Adding SSL KEY certificate');
    });

    it('send request with settings enabled (by testing followRedirects)', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/db/fixtures/nedb --requestNamePattern "withSettings" --verbose "Insomnia Designer" wrk_0b96eff';
      const result = await runCliFromRoot(input);
      expect(result.stdout).not.toContain("Issue another request to this URL: 'https://insomnia.rest/'");
    });

    it('run collection: run requests in specified order', async () => {
      const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/three-requests.yml -i req_6063adcdab5b409e9b4f00f47322df4a -i req_3fd28aabbb18447abab1f45e6ee4bdc1 -e env_86e135 wrk_c992d40 --verbose';
      const result = await runCliFromRoot(input);

      expect(result.code).toBe(0);
      const firstReqLogPosition = result.stdout.indexOf('Running request: 2 req_6063adcdab5b409e9b4f00f47322df4a');
      const secondReqLogPosition = result.stdout.indexOf('Running request: 1 req_3fd28aabbb18447abab1f45e6ee4bdc1');

      expect(firstReqLogPosition).toBeGreaterThanOrEqual(0);
      expect(secondReqLogPosition).toBeGreaterThanOrEqual(0);

      expect(secondReqLogPosition).toBeGreaterThan(firstReqLogPosition);
    });
  });
});

const packagedSuccessCodes = shouldReturnSuccessCode.map(x => x.replace('$PWD/packages/insomnia-inso/bin/inso', '$PWD/packages/insomnia-inso/binaries/inso'));
const packagedErrorCodes = shouldReturnErrorCode.map(x => x.replace('$PWD/packages/insomnia-inso/bin/inso', '$PWD/packages/insomnia-inso/binaries/inso'));

describe('inso packaged binary', () => {
  describe('exit codes are consistent', () => {
    it.each(packagedSuccessCodes)('exit code should be 0: %p', async input => {
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.code).toBe(0);
    });
    it.each(packagedErrorCodes)('exit code should be 1: %p', async input => {
      const result = await runCliFromRoot(input);
      if (result.code !== 1) {
        console.log(result);
      }
      expect(result.code).toBe(1);
    });
  });
});

const helpCommands = [
  '$PWD/packages/insomnia-inso/bin/inso -h',
  '$PWD/packages/insomnia-inso/bin/inso --help',
  '$PWD/packages/insomnia-inso/bin/inso help',
  '$PWD/packages/insomnia-inso/bin/inso generate -h',
  '$PWD/packages/insomnia-inso/bin/inso run -h',
  '$PWD/packages/insomnia-inso/bin/inso run test -h',
  '$PWD/packages/insomnia-inso/bin/inso lint -h',
  '$PWD/packages/insomnia-inso/bin/inso lint spec -h',
  '$PWD/packages/insomnia-inso/bin/inso export -h',
  '$PWD/packages/insomnia-inso/bin/inso export spec -h',
];
describe('Snapshot for', () => {
  it.each(helpCommands)('"inso %s"', async input => {
    const { stdout } = await runCliFromRoot(input);
    expect(stdout).toMatchSnapshot();
  });
});

// Execute the command in the root directory of the project
export const runCliFromRoot = (input: string): Promise<{ code: number; error: ExecException | null; stdout: string; stderr: string }> => {
  return new Promise(resolve => exec(input, { cwd: path.resolve(__dirname, '../../..') },
    (error, stdout, stderr) => resolve({ code: error?.code || 0, error, stdout, stderr })));
};
