import { describe, expect, it } from 'vitest';

import { getListFromFileOrUrl } from './cli';

describe('getListFromFileOrUrl()', () => {
  it('parses simple csv', () => {
    expect(getListFromFileOrUrl('a,b\n1,2\n3,4', 'csv')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(getListFromFileOrUrl('origin,destination\n"New York, NY","Boston, MA"\n', 'csv')).toEqual([
      { origin: 'New York, NY', destination: 'Boston, MA' },
    ]);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(getListFromFileOrUrl('name,quote\n"John ""JJ"" Smith",hello', 'csv')).toEqual([
      { name: 'John "JJ" Smith', quote: 'hello' },
    ]);
  });

  it('handles CRLF line breaks', () => {
    expect(getListFromFileOrUrl('a,b\r\n1,2\r\n', 'csv')).toEqual([{ a: '1', b: '2' }]);
  });

  it('handles newlines inside quoted fields', () => {
    expect(getListFromFileOrUrl('a,b\n"line1\nline2",2', 'csv')).toEqual([{ a: 'line1\nline2', b: '2' }]);
  });

  it('defaults missing trailing cells to empty string', () => {
    expect(getListFromFileOrUrl('a,b,c\n1,2', 'csv')).toEqual([{ a: '1', b: '2', c: '' }]);
  });

  it('throws when there are fewer than two rows', () => {
    expect(() => getListFromFileOrUrl('a,b', 'csv')).toThrow(
      'CSV file must contain at least two rows with first row as variable names',
    );
  });

  it('throws for unsupported file types', () => {
    expect(() => getListFromFileOrUrl('anything', 'yaml')).toThrow('Uploaded file is unsupported yaml');
  });
});
