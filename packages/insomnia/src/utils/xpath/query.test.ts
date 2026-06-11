import { describe, expect, it } from 'vitest';

import { queryXPath } from './query';
/**
 * @vitest-environment jsdom
 */
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
    expect(queryXPath('<x><y>foo</y><y>bar</y></x>', 'substring(//y[1], 2)')).toEqual([{ inner: 'oo', outer: 'oo' }]);
  });

  it('handles text() query', () => {
    expect(queryXPath('<book><title>Harry</title><title>Potter</title></book>', 'local-name(/book)')).toEqual([
      { inner: 'book', outer: 'book' },
    ]);
    expect(queryXPath('<book><title>Harry</title><title>Potter</title></book>', '//title/text()')).toEqual([
      { inner: 'Harry', outer: 'Harry' },
      { inner: 'Potter', outer: 'Potter' },
    ]);
  });

  it('handles count() query', () => {
    expect(queryXPath('<store><book/><book/><book/></store>', 'count(//book)')).toEqual([{ inner: '3', outer: '3' }]);
    expect(queryXPath('<store><book/></store>', 'count(//book)')).toEqual([{ inner: '1', outer: '1' }]);
    expect(queryXPath('<store/>', 'count(//book)')).toEqual([{ inner: '0', outer: '0' }]);
  });

  it('handles sum() query', () => {
    expect(queryXPath('<r><n>1</n><n>2</n><n>3</n></r>', 'sum(//n)')).toEqual([{ inner: '6', outer: '6' }]);
  });

  it('handles boolean() query', () => {
    expect(queryXPath('<x><y/></x>', 'boolean(//y)')).toEqual([{ inner: 'true', outer: 'true' }]);
    expect(queryXPath('<x/>', 'boolean(//y)')).toEqual([{ inner: 'false', outer: 'false' }]);
  });

  it('handles invalid query', () => {
    expect(() => {
      queryXPath('<hi>there</hi>', '//[]');
    }).toThrowError('XPath parse error');
  });
});
