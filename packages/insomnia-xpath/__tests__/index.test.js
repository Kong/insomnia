const { query } = require('..');

function q(description, args, result) {
  it(description, () => {
    expect(query(...args)).toEqual(result);
  });
}

describe('query()', () => {
  q('handles missing query', ['<foo><bar></bar></foo>'], []);

  q(
    'handles basic query',
    ['<x><y>foo</y><y>bar</y></x>', '//y'],
    [{ inner: 'foo', outer: '<y>foo</y>' }, { inner: 'bar', outer: '<y>bar</y>' }]
  );

  q(
    'handles attribute query',
    ['<x><y foo="bar">foo</y><y hi="there">bar</y></x>', '//*[@foo="bar"]'],
    [{ inner: 'foo', outer: '<y foo="bar">foo</y>' }]
  );

  q(
    'handles string query',
    ['<x><y>foo</y><y>bar</y></x>', 'substring(//y[1], 2)'],
    [{ inner: 'oo', outer: 'oo' }]
  );

  it('handles invalid query', () => {
    expect(() => query('<hi>there</hi>', '//[]')).toThrowError('Invalid XPath query: //[]');
  });
});
