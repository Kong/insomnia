import { conversionTypeMap, generateConfig, GenerateConfigOptions } from './generate-config';
import o2k from 'openapi-2-kong';
import path from 'path';
import { writeFileWithCliOptions } from '../write-file';
import { globalBeforeAll, globalBeforeEach } from '../jest/before';
import { logger } from '../logger';
import { InsoError } from '../errors';
import os from 'os';
import { UNKNOWN } from '../types';

jest.mock('openapi-2-kong');
jest.mock('../write-file');

describe('generateConfig()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

  const mock = (mockFn: UNKNOWN) => mockFn;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const filePath = 'file.yaml';

  it('should should not generate if type arg is invalid', async () => {
    await generateConfig(filePath, {
      // @ts-expect-error intentionally invalid input
      type: 'invalid',
    });
    expect(o2k.generate).not.toHaveBeenCalled();
    expect(logger.__getLogs().fatal).toEqual([
      'Config type "invalid" not unrecognized. Options are [kubernetes, declarative].',
    ]);
  });

  it('should print conversion documents to console', async () => {
    mock(o2k.generate).mockResolvedValue({
      documents: ['a', 'b'],
    });
    await generateConfig(filePath, {
      type: 'kubernetes',
    });
    expect(o2k.generate).toHaveBeenCalledWith(filePath, conversionTypeMap.kubernetes);
    expect(logger.__getLogs().log).toEqual(['a\n---\nb\n']);
  });

  it('should load identifier from database', async () => {
    mock(o2k.generateFromString).mockResolvedValue({
      documents: ['a', 'b'],
    });
    await generateConfig('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      type: 'kubernetes',
      workingDir: 'src/db/fixtures/git-repo',
    });
    expect(o2k.generateFromString).toHaveBeenCalled();
    expect(logger.__getLogs().log).toEqual(['a\n---\nb\n']);
  });

  it('should output generated document to a file', async () => {
    mock(o2k.generate).mockResolvedValue({
      documents: ['a', 'b'],
    });
    const outputPath = 'this-is-the-output-path';
    mock(writeFileWithCliOptions).mockResolvedValue(outputPath);
    const options: Partial<GenerateConfigOptions> = {
      type: 'kubernetes',
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
    expect(logger.__getLogs().log).toEqual([`Configuration generated to "${outputPath}".`]);
  });

  it('should return false if failed to write file', async () => {
    mock(o2k.generate).mockResolvedValue({
      documents: ['a', 'b'],
    });
    const error = new Error('error message');
    mock(writeFileWithCliOptions).mockRejectedValue(error);
    const options: Partial<GenerateConfigOptions> = {
      type: 'kubernetes',
      output: 'output.yaml',
      workingDir: 'working/dir',
    };
    const result = generateConfig(filePath, options);
    await expect(result).rejects.toThrowError(error);
  });

  it('should generate documents using workingDir', async () => {
    mock(o2k.generate).mockResolvedValue({
      documents: ['a', 'b'],
    });
    const outputPath = 'this-is-the-output-path';
    mock(writeFileWithCliOptions).mockResolvedValue(outputPath);
    const result = await generateConfig('file.yaml', {
      type: 'kubernetes',
      workingDir: 'test/dir',
      output: 'output.yaml',
    });
    expect(result).toBe(true); // Read from workingDir

    expect(o2k.generate).toHaveBeenCalledWith(
      path.normalize('test/dir/file.yaml'),
      conversionTypeMap.kubernetes,
    );
    expect(logger.__getLogs().log).toEqual([`Configuration generated to "${outputPath}".`]);
  });

  it('should generate documents using absolute path', async () => {
    mock(o2k.generate).mockResolvedValue({
      documents: ['a', 'b'],
    });
    const outputPath = 'this-is-the-output-path';
    mock(writeFileWithCliOptions).mockResolvedValue(outputPath);
    const absolutePath = path.join(os.tmpdir(), 'dev', 'file.yaml');
    const result = await generateConfig(absolutePath, {
      type: 'kubernetes',
      workingDir: 'test/dir',
      output: 'output.yaml',
    });
    expect(result).toBe(true); // Read from workingDir

    expect(o2k.generate).toHaveBeenCalledWith(absolutePath, conversionTypeMap.kubernetes);
    expect(logger.__getLogs().log).toEqual([`Configuration generated to "${outputPath}".`]);
  });

  it('should throw InsoError if there is an error thrown by openapi-2-kong', async () => {
    const error = new Error('err');
    mock(o2k.generate).mockRejectedValue(error);
    const promise = generateConfig('file.yaml', {
      type: 'kubernetes',
    });
    await expect(promise).rejects.toThrowError(
      new InsoError('There was an error while generating configuration', error),
    );
  });

  it('should warn if no valid spec can be found', async () => {
    mock(o2k.generate).mockResolvedValue({});
    const result = await generateConfig('file.yaml', {
      type: 'kubernetes',
    });
    expect(result).toBe(false);
    expect(logger.__getLogs().log).toEqual([
      'Could not find a valid specification to generate configuration.',
    ]);
  });
});
