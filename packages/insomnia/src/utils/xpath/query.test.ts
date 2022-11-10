import { describe, expect, it } from '@jest/globals';

import { queryXPath } from './query';

describe('queryXPath()', () => {
  it('handles missing query', () => {
    expect(() => {
      queryXPath('<foo><bar></bar></foo>');
    }).toThrowError('Must pass an XPath query.');
  });

  it('handles basic query', () => {
    expect(queryXPath('<x><y>foo</y><y>bar</y></x>', '//y')).toEqual([
      { inner: 'foo', outer: '<y>foo</y>' },
      { inner: 'bar', outer: '<y>bar</y>' },
    ]);
  });

  it('handles attribute query', () => {
    expect(queryXPath('<x><y foo="bar">foo</y><y hi="there">bar</y></x>', '//*[@foo="bar"]')).toEqual([
      { inner: 'foo', outer: '<y foo="bar">foo</y>' },
    ]);
  });

  it('handles string query', () => {
    expect(queryXPath('<x><y>foo</y><y>bar</y></x>', 'substring(//y[1], 2)')).toEqual([
      { inner: 'oo', outer: 'oo' },
    ]);
  });

  it('handles text() query', () => {
    expect(queryXPath('<book><title>Harry</title><title>Potter</title></book>', 'local-name(/book)'))
      .toEqual([{ 'inner': 'book', 'outer': 'book' }]);
    expect(queryXPath('<book><title>Harry</title><title>Potter</title></book>', '//title/text()'))
      .toEqual([{ 'inner': 'Harry', 'outer': 'Harry' }, { 'inner': 'Potter', 'outer': 'Potter' }]);
  });

  it('handles invalid query', () => {
    expect(() => {
      queryXPath('<hi>there</hi>', '//[]');
    }).toThrowError('Invalid XPath query: //[]');
  });
});
