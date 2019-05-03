import { diff, __internal } from '../diff';

describe('diff()', () => {
  it('creates block map', () => {
    const result = __internal.getBlockMap('Hello World!!', 3);
    expect(result).toEqual({
      dbc2d1fed0dc37a70aea0f376958c802eddc0559: [
        {
          start: 0,
          len: 3,
          hash: 'dbc2d1fed0dc37a70aea0f376958c802eddc0559',
        },
      ],
      '263b8ac41bd2ffb775af535c54d8b0a0e6b9e743': [
        {
          start: 3,
          len: 3,
          hash: '263b8ac41bd2ffb775af535c54d8b0a0e6b9e743',
        },
      ],
      '3603dd999f7dd952041d3bdb27f74e511cfd6b2a': [
        {
          start: 6,
          len: 3,
          hash: '3603dd999f7dd952041d3bdb27f74e511cfd6b2a',
        },
      ],
      c20d168802bbae1c84f90b9b0495e0d918da3aea: [
        {
          start: 9,
          len: 3,
          hash: 'c20d168802bbae1c84f90b9b0495e0d918da3aea',
        },
      ],
      '0ab8318acaf6e678dd02e2b5c343ed41111b393d': [
        {
          start: 12,
          len: 1,
          hash: '0ab8318acaf6e678dd02e2b5c343ed41111b393d',
        },
      ],
    });
  });

  it('creates operations', () => {
    // hel|lo |Wor|ld!|!
    const result = diff('Hello World!!', 'Hello there World!!', 3);
    expect(result).toEqual([
      { type: 'COPY', start: 0, len: 6 },
      { type: 'INSERT', content: 'there ' },
      { type: 'COPY', start: 6, len: 7 },
    ]);
  });

  it('creates operations 2', () => {
    const result2 = diff(
      'Hello, this is a pretty long sentence about not much at all.',
      'Hello, this is a pretty short sentence.',
      2,
    );
    expect(result2).toEqual([
      { len: 24, start: 0, type: 'COPY' },
      { content: 'shor', type: 'INSERT' },
      { len: 2, start: 42, type: 'COPY' },
      { content: 's', type: 'INSERT' },
      { len: 7, start: 30, type: 'COPY' },
      { content: '.', type: 'INSERT' },
    ]);
  });
});
