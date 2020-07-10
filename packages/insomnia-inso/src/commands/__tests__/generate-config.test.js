// @flow
import { ConversionTypeMap, generateConfig } from '../generate-config';
import type { GenerateConfigOptions } from '../generate-config';
import o2k from 'openapi-2-kong';
import fs from 'fs';
import path from 'path';

jest.mock('openapi-2-kong');

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

  it('should write generated documents to file system', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockImplementation(() => {});
    mock(o2k.generate).mockResolvedValue({ documents: ['a', 'b'] });

    await generateConfig(filePath, { ...base, output: 'output.yaml' });

    expect(o2k.generate).toHaveBeenCalledWith(filePath, ConversionTypeMap[base.type]);
    expect(writeFileSpy).toHaveBeenCalledWith('output.yaml', 'a\n---\nb\n');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should generate documents using workingDir', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockImplementation(() => {});
    mock(o2k.generate).mockResolvedValue({ documents: ['a', 'b'] });

    await generateConfig('file.yaml', {
      ...base,
      workingDir: 'test/dir',
      output: 'output.yaml',
    });

    // Read from workingDir
    expect(o2k.generate).toHaveBeenCalledWith(
      path.normalize('test/dir/file.yaml'),
      ConversionTypeMap[base.type],
    );
    expect(writeFileSpy).toHaveBeenCalledWith(
      path.normalize('test/dir/output.yaml'),
      'a\n---\nb\n',
    );
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
