import type { ExecException } from 'node:child_process';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

// Tests both bundle and packaged versions of the CLI with the same commands and expectations.
// Intended to be coarse grained (only checks for success or failure) smoke test to ensure packaging worked as expected.

const shouldReturnSuccessCode = [
  // help
  '$PWD/apps/cli/bin/inso -h',

  // lint spec
  // as identifier filepath
  '$PWD/apps/cli/bin/inso lint spec apps/cli/src/commands/fixtures/openapi-spec.yaml',
  // as identifier filepath with spectral.yaml
  '$PWD/apps/cli/bin/inso lint spec apps/cli/src/commands/fixtures/with-ruleset/path-plugin.yaml',
  // as working directory and identifier filename
  '$PWD/apps/cli/bin/inso lint spec -w apps/cli/src/commands/fixtures/with-ruleset path-plugin.yaml',
  // as working directory containing nedb
  '$PWD/apps/cli/bin/inso lint spec -w apps/cli/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/apps/cli/bin/inso lint spec -w apps/cli/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/apps/cli/bin/inso lint spec -w apps/cli/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',
  // export spec nedb, git-repo, export file
  '$PWD/apps/cli/bin/inso export spec -w apps/cli/src/db/fixtures/nedb spc_46c5a4',
  '$PWD/apps/cli/bin/inso export spec -w apps/cli/src/db/fixtures/git-repo spc_46c5a4',
  '$PWD/apps/cli/bin/inso export spec -w apps/cli/src/db/fixtures/insomnia-v4/insomnia_v4.yaml spc_3b2850',
  '$PWD/apps/cli/bin/inso export spec -w apps/cli/src/db/fixtures/insomnia-v5/example-spec.yaml "My Design Document"',

  // run test
  // nedb, gitrepo, export file
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/nedb -e env_env_ca046a uts_fe901c',
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/nedb -e env_env_ca046a --reporter min uts_fe901c',
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/nedb -e env_0568bc9 uts_a29c6e -f $PWD/packages',
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/git-repo -e env_env_ca046a uts_fe901c',
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/insomnia-v4/insomnia_v4.yaml -e env_env_0e4670 spc_3b2850',

  // export file, request can inherit auth headers and variables from folder, also test --disableCertValidation with local https smoke test server
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/examples/folder-inheritance-document.yml spc_a8144e --verbose --disableCertValidation',

  // run collection
  // with auth
  '$PWD/apps/cli/bin/inso run collection -w packages/insomnia-smoke-test/fixtures/auth-types.yaml wrk_ca4cb9',
  // export file
  '$PWD/apps/cli/bin/inso run collection -w packages/insomnia-smoke-test/fixtures/simple.yaml -e production wrk_dc393c',
  // with regex filter
  '$PWD/apps/cli/bin/inso run collection -w packages/insomnia-smoke-test/fixtures/simple.yaml -e production --requestNamePattern "example http" wrk_dc393c',
  // after-response script and test
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/after-response.yml wrk_616795 --verbose',
  // transient variables
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/transient-variables.yml wrk_3d6697b --verbose',
  // select request by id
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/three-requests.yml -i req_3fd28aabbb18447abab1f45e6ee4bdc1 -i req_6063adcdab5b409e9b4f00f47322df4a wrk_c992d40',
  // setNextRequest runs the next request then ends
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/set-next-request.yml wrk_cbc89e',
  // multiple --env-var overrides
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/with-missing-env-vars.yml -i req_3fd28aabbb18447abab1f45e6ee4bdc1 --env-var firstkey=first --env-var secondkey=second wrk_c992d40',
  // globals file path env overrides
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/with-missing-env-vars.yml -i req_3fd28aabbb18447abab1f45e6ee4bdc1 --globals apps/cli/src/examples/global-environment.yml wrk_c992d40',
  // with timeout success
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/timeout-test.yml -i req_two_seconds --requestTimeout 3000 wrk_timeout_test',
];

const shouldReturnErrorCode = [
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/nedb -e env_env_ca046a uts_7f0f85',
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/git-repo -e env_env_ca046a uts_7f0f85',
  '$PWD/apps/cli/bin/inso lint spec -w apps/cli/src/db/fixtures/git-repo-malformed-spec spc_46c5a4',
  '$PWD/apps/cli/bin/inso lint spec apps/cli/src/db/fixtures/insomnia-v4/malformed.yaml',
  // With require
  '$PWD/apps/cli/bin/inso run test -w apps/cli/src/db/fixtures/insomnia-v5/with-tests.yaml -e env_env_7c2769 uts_1c6207',
  // after-response script and test
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/after-response-failed-test.yml wrk_616795 --verbose',
  // with timeout failure
  '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/timeout-test.yml -i req_two_seconds --requestTimeout 1000 wrk_timeout_test',
];
beforeAll(async () => {
  // ensure the test server is running
  await fetch('http://localhost:4010');
});
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
      const input =
        '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/minimal.yml wrk_5b5ab6 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('HTTP/1.1 200 OK');
      expect(result.stdout).toContain('Preparing request to http://127.0.0.1:4010/');
      expect(result.stdout).toContain('foo bar baz');
    });

    it('insomnia.request.addHeader works', async () => {
      const input =
        '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/script-add-header.yml wrk_5b5ab6 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('HTTP/1.1 200 OK');
      expect(result.stdout).toContain('Preparing request to http://127.0.0.1:4010/');
      expect(result.stdout).toContain('custom-test-header: test-header-value');
    });

    it('require("insomnia-collection") works', async () => {
      const input =
        '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/script-require.yml wrk_5b5ab6 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('X-Hello: hello');
      expect(result.stdout).toContain('GET /echo?k1=v1 HTTP/1.1');
    });

    it('insomnia.sendRequest works', async () => {
      const input =
        '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/script-send-request.yml wrk_cfacae --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('log: we did it: 200');
    });

    it('iterationData and iterationCount args work', async () => {
      const input =
        '$PWD/apps/cli/bin/inso run collection -d packages/insomnia-smoke-test/fixtures/files/runner-data.json -w apps/cli/src/examples/three-requests.yml -n 2 -i req_3fd28aabbb18447abab1f45e6ee4bdc1 -e env_86e135 wrk_c992d40 --verbose';
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('expecting to see:file_value0');
      expect(result.stdout).toContain('expecting to see:file_value1');
    });

    it('send request with client cert and key', async () => {
      const input = `$PWD/apps/cli/bin/inso run collection -w apps/cli/src/db/fixtures/nedb --requestNamePattern "withCertAndCA" --verbose "Insomnia Designer" wrk_0b96eff -f $PWD/packages`;
      const result = await runCliFromRoot(input);
      if (result.code !== 0) {
        console.log(result);
      }
      expect(result.stdout).toContain('Adding SSL PEM certificate');
      expect(result.stdout).toContain('Adding SSL KEY certificate');
    });

    // Disabled this test
    // currently settings loading is disabled, as it could include values like proxies from UI, which might not make sense for the cli.
    // it can be re-enabled if necessary
    // it('send request with settings enabled (by testing followRedirects)', async () => {
    //   const input =
    //     '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/db/fixtures/nedb --requestNamePattern "withSettings" --verbose "Insomnia Designer" wrk_0b96eff';
    //   const result = await runCliFromRoot(input);
    //   expect(result.stdout).not.toContain("Issue another request to this URL: 'https://insomnia.rest/'");
    // });

    it('run collection: run requests in specified order', async () => {
      const input =
        '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/three-requests.yml -i req_6063adcdab5b409e9b4f00f47322df4a -i req_3fd28aabbb18447abab1f45e6ee4bdc1 -e env_86e135 wrk_c992d40 --verbose';
      const result = await runCliFromRoot(input);

      expect(result.code).toBe(0);
      const firstReqLogPosition = result.stdout.indexOf('Running request: 2 req_6063adcdab5b409e9b4f00f47322df4a');
      const secondReqLogPosition = result.stdout.indexOf('Running request: 1 req_3fd28aabbb18447abab1f45e6ee4bdc1');

      expect(firstReqLogPosition).toBeGreaterThanOrEqual(0);
      expect(secondReqLogPosition).toBeGreaterThanOrEqual(0);

      expect(secondReqLogPosition).toBeGreaterThan(firstReqLogPosition);
    });

    it('read and write folder environments', async () => {
      const input =
        '$PWD/apps/cli/bin/inso run collection wrk_cfacae2b022e49c8851c2376674cc890 -w apps/cli/src/examples/script-folder-environments.yml --requestNamePattern "updateFolderValue" --verbose';
      const result = await runCliFromRoot(input);
      expect(result.stdout).toContain('updated value from folder: 666');
    });
  });

  describe('run collection report generation', () => {
    it.each([
      {
        name: 'default report',
        input:
          '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/run-collection-result-report.yml wrk_c5d5b5 -e env_1072af',
        expectedReportFile: './fixtures/run-collection-report/default-report.json',
      },
      {
        name: 'redact report',
        input:
          '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/run-collection-result-report.yml wrk_c5d5b5 -e env_1072af --includeFullData=redact --acceptRisk',
        expectedReportFile: './fixtures/run-collection-report/redact-report.json',
      },
      {
        name: 'plaintext report',
        input:
          '$PWD/apps/cli/bin/inso run collection -w apps/cli/src/examples/run-collection-result-report.yml wrk_c5d5b5 -e env_1072af --includeFullData=plaintext --acceptRisk',
        expectedReportFile: './fixtures/run-collection-report/plaintext-report.json',
      },
    ])('generate report: $name', async ({ input, expectedReportFile }) => {
      const root = path.join(tmpdir(), 'insomnia-cli-test-output');
      const outputFilePath = path.resolve(root, 'run-collection-report-output.json');

      const result = await runCliFromRoot(`${input} --output ${outputFilePath}`);
      expect(result.code).toBe(0);

      const expectedReport = JSON.parse(fs.readFileSync(path.resolve(__dirname, expectedReportFile), 'utf8'));
      expect(fs.existsSync(outputFilePath)).toBe(true);
      const report = JSON.parse(fs.readFileSync(outputFilePath, 'utf8'));

      // Some fields are dynamic so we use expect.any to validate their types/ existence
      expect(report).toEqual({
        ...expectedReport,
        executions: expectedReport.executions.map((exec: any) => ({
          ...exec,
          response: {
            ...exec.response,
            // executionTime can vary so just check it's a number
            responseTime: expect.any(Number),
            headers: exec.response.headers
              ? {
                  ...exec.response.headers,
                  date: expect.any(String),
                }
              : undefined,
          },
          tests: exec.tests.map((test: any) => ({
            ...test,
            executionTime: expect.any(Number),
          })),
        })),
        timing: {
          started: expect.any(Number),
          completed: expect.any(Number),
          responseAverage: expect.any(Number),
          responseMin: expect.any(Number),
          responseMax: expect.any(Number),
        },
      });
    });
  });
});

const packagedSuccessCodes = shouldReturnSuccessCode.map(x =>
  x.replace('$PWD/apps/cli/bin/inso', '$PWD/apps/cli/binaries/inso'),
);
const packagedErrorCodes = shouldReturnErrorCode.map(x =>
  x.replace('$PWD/apps/cli/bin/inso', '$PWD/apps/cli/binaries/inso'),
);

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
  '$PWD/apps/cli/bin/inso -h',
  '$PWD/apps/cli/bin/inso --help',
  '$PWD/apps/cli/bin/inso help',
  '$PWD/apps/cli/bin/inso generate -h',
  '$PWD/apps/cli/bin/inso run -h',
  '$PWD/apps/cli/bin/inso run test -h',
  '$PWD/apps/cli/bin/inso lint -h',
  '$PWD/apps/cli/bin/inso lint spec -h',
  '$PWD/apps/cli/bin/inso export -h',
  '$PWD/apps/cli/bin/inso export spec -h',
];
describe('Snapshot for', () => {
  it.each(helpCommands)('"inso %s"', async input => {
    const { stdout } = await runCliFromRoot(input);
    expect(stdout).toMatchSnapshot();
  });
});

// Execute the command in the root directory of the project
export const runCliFromRoot = (
  input: string,
): Promise<{ code: number; error: ExecException | null; stdout: string; stderr: string }> => {
  return new Promise(resolve =>
    exec(input, { cwd: path.resolve(__dirname, '../../..') }, (error, stdout, stderr) =>
      resolve({ code: error?.code || 0, error, stdout, stderr }),
    ),
  );
};
