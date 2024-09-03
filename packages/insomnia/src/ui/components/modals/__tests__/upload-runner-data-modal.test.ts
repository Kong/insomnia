import { describe, expect, it } from 'vitest';

import { genPreviewTableData } from '../upload-runner-data-modal';

describe('test generate table preview data ', () => {

  it('test normal json input', () => {
    const uploadData = [
      {
        'position': 0,
        'value': 'value0',
      },
      {
        'position': 1,
        'value': 'value1',
      },
      {
        'position': 2,
        'valeu': 'value-typo',
      },
    ];
    const { data, headers } = genPreviewTableData(uploadData);
    expect(headers).toEqual(['position', 'value', 'valeu']);
    expect(data).toEqual([
      {
        'position': 0,
        'value': 'value0',
      },
      {
        'position': 1,
        'value': 'value1',
      },
      {
        'position': 2,
        'valeu': 'value-typo',
      },
    ]);
  });

  it('test complex json input', () => {
    const uploadData = [
      {
        'position': 0,
        'value': 'value0',
      },
      'invalid',
      undefined,
      [1, 2, 3],
      null,
    ];
    // @ts-expect-error test inalid input
    const { data, headers } = genPreviewTableData(uploadData);
    expect(headers).toEqual(['position', 'value']);
    expect(data).toEqual([
      {
        'position': 0,
        'value': 'value0',
      },
    ]);
  });

  it('test invalid json input', () => {
    const uploadData = [
      'invalid',
      [1, 2, 3],
      undefined,
      null,
    ];
    // @ts-expect-error test inalid input
    const { data, headers } = genPreviewTableData(uploadData);
    expect(headers.length).toBe(0);
    expect(data.length).toBe(0);
  });
});
