import execa from 'execa';
import fs from 'fs';
import { getBinPathSync } from 'get-bin-path';
import path from 'path';
import { flatten } from 'ramda';
import { compact } from 'ramda-adjunct';

const binariesDirectory = '../insomnia-inso/binaries';
const npmPackageBinPath = getBinPathSync({ cwd: '../insomnia-inso' });
const binaries = fs.readdirSync(binariesDirectory).map(binary => path.join(binariesDirectory, binary));

type NestedArray<T> = (T | T[])[];

describe.each(compact([npmPackageBinPath, ...binaries]))('inso with %s', binPath => {
  if (!binPath) {
    fail('The inso executable was not found.  Check if it has moved.');
  }

  const inso = (...args: NestedArray<string>) => execa.sync(binPath, flatten(args));

  describe('run test', () => {
    it('should not fail running tests', () => {

      const { failed } = inso(
        'run',
        'test',
        ['--src', 'fixtures/inso-nedb'],
        ['--env', 'Dev'],
        'TestSuite',
      );

      expect(failed).toBe(false);
    });
  });
});
