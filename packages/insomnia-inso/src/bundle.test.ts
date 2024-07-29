
import { exec, ExecException } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';
describe('inso dev bundle', () => {
  it('logs response and timeline with verbose', async () => {
    const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/minimal.yml wrk_5b5ab6 --verbose';
    const result = await runCliFromRoot(input);
    if (result.code !== 0) {
      console.log(result);
    }
    // logs response object
    expect(result.stdout).toContain('status: 200');
    // logs timeline
    expect(result.stdout).toContain('Preparing request to http://127.0.0.1:4010/');
    // expect(result.stdout).toContain('foo bar baz');
  });

});

// Execute the command in the root directory of the project
export const runCliFromRoot = (input: string): Promise<{ code: number; error: ExecException | null; stdout: string; stderr: string }> => {
  return new Promise(resolve => exec(input, { cwd: path.resolve(__dirname, '../../..') },
    (error, stdout, stderr) => resolve({ code: error?.code || 0, error, stdout, stderr })));
};
