import { describe, expect, it } from '@jest/globals';
import { statSync, writeFileSync } from 'fs';

const promiseStuff = async () => {
  writeFileSync('/tmp/experiment', 'some data');
};

describe('experiment', () => {
  it('writes a file', async () => {
    expect.assertions(1);
    await promiseStuff();
    expect(statSync('/tmp/experiment').isFile()).toBeTruthy();
  });
});
