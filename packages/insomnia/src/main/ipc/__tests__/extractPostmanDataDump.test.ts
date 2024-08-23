import path from 'node:path';

import { describe, expect, it } from 'vitest';

import extractPostmanDataDumpHandler from '../extractPostmanDataDump';

describe('extractPostmanDataDump', () => {
  it('should extract data from postman dump', async () => {
    const dataDumpFilePath = path.resolve(__dirname, 'multi_postman_data_dump.zip');
    const result = await extractPostmanDataDumpHandler(null, dataDumpFilePath);
    expect(result).toMatchSnapshot();
  });
});
