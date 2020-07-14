// @flow
import path from 'path';
import { writeFileWithCliOptions } from '../write-file';
import mkdirp from 'mkdirp';
import fs from 'fs';

jest.mock('mkdirp', () => ({
  sync: jest.fn().mockResolvedValue(),
}));

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
  },
}));

describe('writeFileWithCliOptions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should write to output file', () => {
    const output = 'file.yaml';
    const contents = 'contents';
    const fallback = 'fallback.yaml';
    const workingDir = undefined;

    expect(writeFileWithCliOptions(output, contents, fallback, workingDir)).resolves.toBe(
      'file.yaml',
    );
  });

  it('should write to output file under working dir', () => {
    const output = 'file.yaml';
    const contents = 'contents';
    const fallback = 'fallback.yaml';
    const workingDir = 'working/dir';

    expect(writeFileWithCliOptions(output, contents, fallback, workingDir)).resolves.toBe(
      path.normalize('working/dir/file.yaml'),
    );
  });

  it('should write to fallback file if output is a directory', () => {
    const output = 'outputDir';
    const contents = 'contents';
    const fallback = 'fallback.yaml';
    const workingDir = undefined;

    expect(writeFileWithCliOptions(output, contents, fallback, workingDir)).resolves.toBe(
      path.normalize('outputDir/fallback.yaml'),
    );
  });

  it('should write to fallback file if output is a directory under working dir', () => {
    const output = 'outputDir';
    const contents = 'contents';
    const fallback = 'fallback.yaml';
    const workingDir = 'working/dir';

    expect(writeFileWithCliOptions(output, contents, fallback, workingDir)).resolves.toBe(
      path.normalize('working/dir/outputDir/fallback.yaml'),
    );
  });

  it('should ensure the output directory exists', async () => {
    const output = 'output/dir/file.yaml';
    const contents = 'contents';
    const fallback = 'fallback.yaml';
    const workingDir = 'working/dir';

    const result = await writeFileWithCliOptions(output, contents, fallback, workingDir);
    expect(result).toBe(path.normalize('working/dir/output/dir/file.yaml'));

    expect(mkdirp.sync).toHaveBeenCalledWith(path.normalize('working/dir/output/dir'));
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      path.normalize('working/dir/output/dir/file.yaml'),
      contents,
    );
  });
});
