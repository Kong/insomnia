import { DeclarativeConfigResult, generate as _generate, generateFromString as _generateFromString, KongForKubernetesResult } from 'openapi-2-kong';
import os from 'os';
import path from 'path';

import { InsoError } from '../errors';
import { globalBeforeAll, globalBeforeEach } from '../jest/before';
import { logger } from '../logger';
import { writeFileWithCliOptions as _writeFileWithCliOptions } from '../write-file';
import { conversionTypeMap, generateConfig, GenerateConfigOptions } from './generate-config';

jest.mock('openapi-2-kong');
jest.mock('../write-file');

const generate = _generate as jest.MockedFunction<typeof _generate>;
const generateFromString = _generateFromString as jest.MockedFunction<typeof _generateFromString>;
const writeFileWithCliOptions = _writeFileWithCliOptions as jest.MockedFunction<typeof _writeFileWithCliOptions>;

const mockConversionResult: KongForKubernetesResult = {
  // @ts-expect-error -- TSCONVERSION the tests seem to suggest that this is valid, yet it is not allowed by the types.
  documents: ['a', 'b'],
  type: 'kong-for-kubernetes',
  label: '',
  warnings: [],
};

const mockDeclarativeConversionResult: DeclarativeConfigResult = {
  documents: [
    {
      '_format_version': '1.1',
      services: [],
      upstreams: [],
    },
  ],
  type: 'kong-declarative-config',
  label: '',
  warnings: [],
};

describe('generateConfig()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const filePath = 'file.yaml';

  it('should should not generate if type arg is invalid', async () => {
    await generateConfig(filePath, {
      // @ts-expect-error intentionally invalid input
      type: 'invalid',
    });
    expect(generate).not.toHaveBeenCalled();
    expect(logger.__getLogs().fatal).toEqual([
      'Config type "invalid" not unrecognized. Options are [declarative, kubernetes].',
    ]);
  });

  it('should print conversion documents to console', async () => {
    generate.mockResolvedValue(mockConversionResult);

    await generateConfig(filePath, { type: 'kubernetes', tags: 'tag' });

    expect(generate).toHaveBeenCalledWith(filePath, conversionTypeMap.kubernetes, ['tag']);
    expect(logger.__getLogs().log).toEqual(['a\n---\nb\n']);
  });

  it('should load identifier from database', async () => {
    generateFromString.mockResolvedValue(mockConversionResult);
    await generateConfig('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      type: 'kubernetes',
      workingDir: 'src/db/fixtures/git-repo',
      tags: 'first,second',
    });

    expect(generateFromString).toHaveBeenCalledWith(
      expect.stringMatching(/.+/),
      conversionTypeMap.kubernetes,
      ['first', 'second'],
    );
    expect(logger.__getLogs().log).toEqual(['a\n---\nb\n']);
  });

  it('should output generated document to a file', async () => {
    generate.mockResolvedValue(mockConversionResult);
    const outputPath = 'this-is-the-output-path';
    writeFileWithCliOptions.mockResolvedValue(outputPath);
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
    generate.mockResolvedValue(mockConversionResult);
    const error = new Error('error message');
    writeFileWithCliOptions.mockRejectedValue(error);
    const options: Partial<GenerateConfigOptions> = {
      type: 'kubernetes',
      output: 'output.yaml',
      workingDir: 'working/dir',
    };
    const result = generateConfig(filePath, options);
    await expect(result).rejects.toThrowError(error);
  });

  it('should generate documents using workingDir', async () => {
    generate.mockResolvedValue(mockConversionResult);
    const outputPath = 'this-is-the-output-path';
    writeFileWithCliOptions.mockResolvedValue(outputPath);
    const result = await generateConfig(filePath, {
      type: 'kubernetes',
      workingDir: 'test/dir',
      output: 'output.yaml',
    });
    expect(result).toBe(true); // Read from workingDir

    expect(generate).toHaveBeenCalledWith(
      path.normalize('test/dir/file.yaml'),
      conversionTypeMap.kubernetes,
      undefined
    );
    expect(logger.__getLogs().log).toEqual([
      `Configuration generated to "${outputPath}".`,
    ]);
  });

  it('should generate documents using absolute path', async () => {
    generate.mockResolvedValue(mockConversionResult);
    const outputPath = 'this-is-the-output-path';
    writeFileWithCliOptions.mockResolvedValue(outputPath);
    const absolutePath = path.join(os.tmpdir(), 'dev', filePath);
    const result = await generateConfig(absolutePath, {
      type: 'kubernetes',
      workingDir: 'test/dir',
      output: 'output.yaml',
    });
    expect(result).toBe(true);

    // Read from workingDir
    expect(generate).toHaveBeenCalledWith(
      absolutePath,
      conversionTypeMap.kubernetes,
      undefined
    );
    expect(logger.__getLogs().log).toEqual([
      `Configuration generated to "${outputPath}".`,
    ]);
  });

  it('should throw InsoError if there is an error thrown by openapi-2-kong', async () => {
    const error = new Error('err');
    generate.mockRejectedValue(error);
    const promise = generateConfig(filePath, { type: 'kubernetes' });
    await expect(promise).rejects.toThrowError(
      new InsoError('There was an error while generating configuration', error),
    );
  });

  it('should warn if no valid spec can be found', async () => {
    // @ts-expect-error intentionally passing in a bad value
    generate.mockResolvedValue({});
    const result = await generateConfig(filePath, { type: 'kubernetes' });
    expect(result).toBe(false);
    expect(logger.__getLogs().log).toEqual([
      'Could not find a valid specification to generate configuration.',
    ]);
  });

  it('should generate declarative config', async () => {
    generate.mockResolvedValue(mockDeclarativeConversionResult);

    const result = await generateConfig(
      filePath,
      { type: 'declarative' }
    );
    expect(result).toBe(true);
    expect(logger.__getLogs().log).toEqual([
      `_format_version: \"1.1\"
services: []
upstreams: []
`,
    ]);
  });

  it('should generate declarative config as json when format is set to json', async () => {
    generate.mockResolvedValue(mockDeclarativeConversionResult);

    const result = await generateConfig(
      filePath,
      { type: 'declarative', format: 'json' }
    );
    expect(result).toBe(true);
    expect(logger.__getLogs().log).toEqual([
      '{"_format_version":"1.1","services":[],"upstreams":[]}',
    ]);
  });
});
