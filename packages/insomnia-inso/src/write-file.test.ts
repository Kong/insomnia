import { describe, expect, it, jest } from '@jest/globals';
import os from 'os';
import path from 'path';

import { writeFileWithCliOptions } from './write-file';

jest.mock('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(() => { }),
  mkdir: jest.fn().mockResolvedValue(() => { }),
}));

describe('writeFileWithCliOptions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should write to output file', async () => {
    const output = 'file.yaml';
    const contents = 'contents';
    const workingDir = undefined;
    const promise = writeFileWithCliOptions(output, contents, workingDir);
    await expect(promise).resolves.toBe(path.join(process.cwd(), 'file.yaml'));
  });
  it('should write to absolute output file', async () => {
    const absolutePath = path.join(os.tmpdir(), 'dev', 'file.yaml');
    const output = absolutePath;
    const contents = 'contents';
    const workingDir = undefined;
    const promise = writeFileWithCliOptions(output, contents, workingDir);
    await expect(promise).resolves.toBe(absolutePath);
  });
  it('should write to absolute output file and ignore working dir', async () => {
    const absolutePath = path.join(os.tmpdir(), 'dev', 'file.yaml');
    const output = absolutePath;
    const contents = 'contents';
    const workingDir = 'working/dir';
    const promise = writeFileWithCliOptions(output, contents, workingDir);
    await expect(promise).resolves.toBe(absolutePath);
  });
  it('should write to output file under working dir', async () => {
    const output = 'file.yaml';
    const contents = 'contents';
    const workingDir = 'working/dir';
    const promise = writeFileWithCliOptions(output, contents, workingDir);
    await expect(promise).resolves.toBe(path.normalize('working/dir/file.yaml'));
  });
  it('should ensure the output directory exists', async () => {
    const output = 'output/dir/file.yaml';
    const contents = 'contents';
    const workingDir = 'working/dir';
    const result = await writeFileWithCliOptions(output, contents, workingDir);
    expect(result).toEqual(path.normalize('working/dir/output/dir/file.yaml'));
  });
});
