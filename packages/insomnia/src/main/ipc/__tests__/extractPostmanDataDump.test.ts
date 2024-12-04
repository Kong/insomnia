import path from 'node:path';

import { describe, expect, it } from 'vitest';

import extractPostmanDataDumpHandler from '../extractPostmanDataDump';

describe('Postman data dump extract', async () => {
  it('should extract collections and envs from postman data dump', async () => {
    const dataDumpFilePath = path.resolve(__dirname, 'multi_postman_data_dump.zip');
    const extractResult = await extractPostmanDataDumpHandler(null, dataDumpFilePath);
    expect(extractResult).toMatchSnapshot();
  });
});
