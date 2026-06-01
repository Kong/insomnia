import { writeFile } from 'node:fs';

import type { TestSuite } from './generate';
import { generate } from './generate';

export const generateToFile = async (filepath: string, suites: TestSuite[]) => {
  return new Promise<void>((resolve, reject) => {
    const js = generate(suites);
    return writeFile(filepath, js, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
