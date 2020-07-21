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
  // make flow happy
  const mock = (mockFn: any) => mockFn;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should write to output file', () => {
    const output = 'file.yaml';
    const contents = 'contents';
    const workingDir = undefined;

    expect(writeFileWithCliOptions(output, contents, workingDir)).resolves.toStrictEqual({
      outputPath: 'file.yaml',
    });
  });

  it('should write to output file under working dir', () => {
    const output = 'file.yaml';
    const contents = 'contents';
    const workingDir = 'working/dir';

    expect(writeFileWithCliOptions(output, contents, workingDir)).resolves.toStrictEqual({
      outputPath: path.normalize('working/dir/file.yaml'),
    });
  });

  it('should ensure the output directory exists', async () => {
    const output = 'output/dir/file.yaml';
    const contents = 'contents';
    const workingDir = 'working/dir';

    const result = await writeFileWithCliOptions(output, contents, workingDir);
    expect(result).toStrictEqual({
      outputPath: path.normalize('working/dir/output/dir/file.yaml'),
    });

    expect(mkdirp.sync).toHaveBeenCalledWith(path.normalize('working/dir/output/dir'));
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      path.normalize('working/dir/output/dir/file.yaml'),
      contents,
    );
  });

  it('should return an error if make directory fails', () => {
    const error = new Error('mkdir sync error');
    mock(mkdirp.sync).mockRejectedValue(error);

    expect(writeFileWithCliOptions('file.yaml', 'contents')).resolves.toStrictEqual({
      outputPath: 'file.yaml',
      error,
    });
  });

  it('should return an error if write file fails', () => {
    const error = new Error('fs promises writeFile error');
    mock(fs.promises.writeFile).mockRejectedValue(error);

    expect(writeFileWithCliOptions('file.yaml', 'contents')).resolves.toStrictEqual({
      outputPath: 'file.yaml',
      error,
    });
  });
});
