// @flow

import { runTests } from '../index';
import os from 'os';
import fs from 'fs';
import path from 'path';

const exampleTest = `
const assert = require('assert');
describe('Example', () => {
  it('should be true', async () => assert.equal(true, true));
  it('should fail', async () => assert.equal(true, false));
});
`;

describe('run', () => {
  let generatedFiles = [];
  beforeEach(() => {
    generatedFiles = [];
  });

  afterEach(() => {
    generatedFiles.forEach(deleteTmp);
  });

  it('runs a mocha suite', async () => {
    const testPath = writeToTmp(exampleTest);

    const { stats } = await runTests(testPath);
    expect(stats.passes).toBe(1);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(1);
  });

  it('works on multiple files', async () => {
    const testPath1 = writeToTmp(exampleTest);
    const testPath2 = writeToTmp(exampleTest);

    const { stats } = await runTests([testPath1, testPath2]);
    expect(stats.passes).toBe(2);
    expect(stats.tests).toBe(4);
    expect(stats.failures).toBe(2);
  });
});

function writeToTmp(contents: string): string {
  const tmpPath = path.join(os.tmpdir(), 'insomnia-testing', `${Math.random()}.test.js`);
  fs.writeFileSync(tmpPath, contents);
  return tmpPath;
}

function deleteTmp(filePath: string): void {
  fs.unlinkSync(filePath);
}
