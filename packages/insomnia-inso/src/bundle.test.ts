
import { exec, ExecException } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';
describe('inso dev bundle', () => {
  it('console logs a script', async () => {
    const input = '$PWD/packages/insomnia-inso/bin/inso run collection -w packages/insomnia-inso/src/examples/minimal.yml wrk_5b5ab6 --verbose';
    const result = await cli(input);
    if (result.code !== 0) {
      console.log(result);
    }
    expect(result.stdout).toContain('foo bar baz');
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
