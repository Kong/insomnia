// @flow
import { ConversionTypeMap, generateConfig } from '../generate-config';
import type { GenerateConfigOptions } from '../generate-config';
import o2k from 'openapi-2-kong';
import path from 'path';
import { writeFileWithCliOptions } from '../../write-file';

jest.mock('openapi-2-kong');
jest.mock('../../write-file');

describe('generateConfig()', () => {
  // make flow happy
  const mock = (mockFn: any) => mockFn;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const base: GenerateConfigOptions = {
    type: 'kubernetes',
    output: undefined,
  };

  const filePath = 'file.yaml';

  it('should should not generate if type arg is invalid', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await generateConfig(filePath, { ...base, type: 'invalid' });

    expect(o2k.generate).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Config type "invalid" not unrecognized. Options are [kubernetes, declarative].',
    );
  });

  it('should print conversion documents to console', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mock(o2k.generate).mockResolvedValue({ documents: ['a', 'b'] });

    await generateConfig(filePath, base);

    expect(o2k.generate).toHaveBeenCalledWith(filePath, ConversionTypeMap[base.type]);
    expect(consoleSpy).toHaveBeenCalledWith('a\n---\nb\n');
  });

  it('should load identifier from database', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mock(o2k.generateFromString).mockResolvedValue({ documents: ['a', 'b'] });

    await generateConfig('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      ...base,
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(o2k.generateFromString).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('a\n---\nb\n');
  });

  it('should output generated document to a file', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mock(o2k.generate).mockResolvedValue({ documents: ['a', 'b'] });
    const outputPath = 'this-is-the-output-path';
    mock(writeFileWithCliOptions).mockResolvedValue({ outputPath });

    const options = {
      ...base,
      output: 'output.yaml',
      workingDir: 'working/dir',
    };

    const result = await generateConfig(filePath, options);

    expect(result).toBe(true);

    expect(writeFileWithCliOptions).toHaveBeenCalledWith(
      options.output,
      'a\n---\nb\n',
      options.workingDir,
    );

    expect(consoleSpy).toHaveBeenCalledWith(`Configuration generated to "${outputPath}".`);
  });

  it('should return false if failed to write file', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mock(o2k.generate).mockResolvedValue({ documents: ['a', 'b'] });
    const outputPath = 'this-is-the-output-path';
    const error = new Error('error message');

    mock(writeFileWithCliOptions).mockResolvedValue({ outputPath, error });

    const options = {
      ...base,
      output: 'output.yaml',
      workingDir: 'working/dir',
    };

    const result = await generateConfig(filePath, options);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(`Failed to write to "${outputPath}".\n`, error);
  });

  it('should generate documents using workingDir', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mock(o2k.generate).mockResolvedValue({ documents: ['a', 'b'] });
    mock(writeFileWithCliOptions).mockResolvedValue({ outputPath: 'this-is-the-output-path' });

    const result = await generateConfig('file.yaml', {
      ...base,
      workingDir: 'test/dir',
      output: 'output.yaml',
    });

    expect(result).toBe(true);

    // Read from workingDir
    expect(o2k.generate).toHaveBeenCalledWith(
      path.normalize('test/dir/file.yaml'),
      ConversionTypeMap[base.type],
    );
  });
});
