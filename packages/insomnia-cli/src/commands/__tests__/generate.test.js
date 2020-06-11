// @flow
import { generateConfig } from '../generate';
import type { GenerateConfigOptions } from '../generate';
import o2k from 'openapi-2-kong';

jest.mock('openapi-2-kong');

const base: GenerateConfigOptions = {
  filePath: 'file.yaml',
  type: 'kubernetes',
  output: undefined,
};

describe('generateConfig()', () => {
  it('should should not generate if type arg is invalid', async () => {
    await generateConfig({ ...base, type: 'invalid' });
    expect(o2k.generate).not.toHaveBeenCalled();
  });
});
