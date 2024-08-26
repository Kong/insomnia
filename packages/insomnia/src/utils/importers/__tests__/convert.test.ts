import path from 'node:path';

import { fail } from 'assert';
import { describe, expect, it } from 'vitest';

import extractPostmanDataDumpHandler from '../../../main/ipc/extractPostmanDataDump';
import { convert, convertPostmanDataDump, dotInKeyNameInvariant } from '../convert';

describe('Postman data dump convert', async () => {
  it('should convert postman data dump', async () => {
    const dataDumpFilePath = path.resolve(__dirname, '../../../main/ipc/__tests__/multi_postman_data_dump.zip');
    const extractResult = await extractPostmanDataDumpHandler(null, dataDumpFilePath);
    const convertResult = await convertPostmanDataDump(extractResult.data);
    if (convertResult?.data) {
      delete convertResult.data.__export_date;
    }
    convertResult.data.resources.forEach((resource: any) => {
      delete resource.workspaceUuid;
      delete resource.metaSortKey;
      delete resource.meta;
    });
    expect(convertResult).toMatchSnapshot();
  });
});

describe('Import errors', () => {
  it('fail to find importer', async () => {
    try {
      await convert('foo');
      fail('Should have thrown error');
    } catch (err) {
      expect(err.message).toBe('No importers found for file');
    }
  });
});

describe('test dotInKeyNameInvariant', () => {
  [
    {
      input: {
        '.hehe': 'haha',
      },
      noError: false,
    },
    {
      input: {
        '.': '',
        'arr': [''],
      },
      noError: false,
    },
    {
      input: [
        '',
        1,
      ],
      noError: true,
    },
  ].forEach(testCase => {
    it(`check: ${testCase.input}`, () => {
      let e: Error | undefined = undefined;

      try {
        dotInKeyNameInvariant(testCase.input);
      } catch (ex) {
        e = ex;
      }
      expect(e === undefined).toBe(testCase.noError);
    });
  });
});
