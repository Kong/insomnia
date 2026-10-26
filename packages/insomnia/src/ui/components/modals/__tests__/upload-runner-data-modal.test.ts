import { describe, expect, it } from 'vitest';

import { genPreviewTableData, parseCsvUploadData } from '../upload-runner-data-modal';

describe('test generate table preview data ', () => {
  it('test normal json input', () => {
    const uploadData = [
      {
        position: 0,
        value: 'value0',
      },
      {
        position: 1,
        value: 'value1',
      },
      {
        position: 2,
        valeu: 'value-typo',
      },
    ];
    const { data, headers } = genPreviewTableData(uploadData);
    expect(headers).toEqual(['position', 'value', 'valeu']);
    expect(data).toEqual([
      {
        position: 0,
        value: 'value0',
      },
      {
        position: 1,
        value: 'value1',
      },
      {
        position: 2,
        valeu: 'value-typo',
      },
    ]);
  });

  it('test complex json input', () => {
    const uploadData = [
      {
        position: 0,
        value: 'value0',
      },
      'invalid',
      undefined,
      [1, 2, 3],
      null,
    ];
    // @ts-expect-error test invalid input
    const { data, headers } = genPreviewTableData(uploadData);
    expect(headers).toEqual(['position', 'value']);
    expect(data).toEqual([
      {
        position: 0,
        value: 'value0',
      },
    ]);
  });

  it('test invalid json input', () => {
    const uploadData = ['invalid', [1, 2, 3], undefined, null];
    // @ts-expect-error test invalid input
    const { data, headers } = genPreviewTableData(uploadData);
    expect(headers.length).toBe(0);
    expect(data.length).toBe(0);
  });
});

describe('parseCsvUploadData()', () => {
  it('parses simple csv', () => {
    expect(parseCsvUploadData('a,b\n1,2\n3,4')).toEqual({
      headers: ['a', 'b'],
      data: [
        { a: '1', b: '2' },
        { a: '3', b: '4' },
      ],
    });
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsvUploadData('origin,destination\n"New York, NY","Boston, MA"\n')).toEqual({
      headers: ['origin', 'destination'],
      data: [{ origin: 'New York, NY', destination: 'Boston, MA' }],
    });
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseCsvUploadData('name,quote\n"John ""JJ"" Smith",hello')).toEqual({
      headers: ['name', 'quote'],
      data: [{ name: 'John "JJ" Smith', quote: 'hello' }],
    });
  });

  it('handles CRLF line breaks', () => {
    expect(parseCsvUploadData('a,b\r\n1,2\r\n')).toEqual({
      headers: ['a', 'b'],
      data: [{ a: '1', b: '2' }],
    });
  });

  it('handles newlines inside quoted fields', () => {
    expect(parseCsvUploadData('a,b\n"line1\nline2",2')).toEqual({
      headers: ['a', 'b'],
      data: [{ a: 'line1\nline2', b: '2' }],
    });
  });

  it('defaults missing trailing cells to empty string', () => {
    expect(parseCsvUploadData('a,b,c\n1,2')).toEqual({
      headers: ['a', 'b', 'c'],
      data: [{ a: '1', b: '2', c: '' }],
    });
  });

  it('returns null when there are fewer than two rows', () => {
    expect(parseCsvUploadData('a,b')).toBeNull();
    expect(parseCsvUploadData('')).toBeNull();
  });
});
