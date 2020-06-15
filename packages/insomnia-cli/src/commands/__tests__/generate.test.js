// @flow
import { ConversionTypeMap, generateConfig } from '../generate';
import type { GenerateConfigOptions } from '../generate';
import o2k from 'openapi-2-kong';
import fs from 'fs';
import path from 'path';

jest.mock('openapi-2-kong');
jest.mock('fs');

describe('generateConfig()', () => {
  // make flow happy
  const mock = (mockFn: any) => mockFn;
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const base: GenerateConfigOptions = {
    type: 'kubernetes',
    output: undefined,
    workingDir: 'src/commands/__fixtures__/git-repo',
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

  it('should write converted documents to file system', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mock(o2k.generate).mockResolvedValue({ documents: ['a', 'b'] });

    await generateConfig(filePath, { ...base, output: 'output.yaml' });

    expect(o2k.generate).toHaveBeenCalledWith(filePath, ConversionTypeMap[base.type]);
    expect(fs.writeFileSync).toHaveBeenCalledWith(path.resolve('output.yaml'), 'a\n---\nb\n');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
