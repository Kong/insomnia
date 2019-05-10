import { responseToObject } from '../misc';
import { globalBeforeEach } from '../../../__jest__/before-each';

describe('responseToObject()', () => {
  beforeEach(globalBeforeEach);

  it('works in the general case', () => {
    const body = JSON.stringify({
      str: 'hi',
      num: 10,
    });

    const keys = ['str', 'num'];

    expect(responseToObject(body, keys)).toEqual({
      str: 'hi',
      num: 10,
    });
  });

  it('skips things not in keys', () => {
    const body = JSON.stringify({
      str: 'hi',
      num: 10,
      other: 'thing',
    });

    const keys = ['str'];

    expect(responseToObject(body, keys)).toEqual({
      str: 'hi',
    });
  });

  it('works with things not found', () => {
    const body = JSON.stringify({});

    const keys = ['str'];

    expect(responseToObject(body, keys)).toEqual({
      str: null,
    });
  });

  it('works with default values', () => {
    const body = JSON.stringify({
      str: 'hi',
      num: 10,
    });

    const keys = ['str', 'missing'];

    const defaults = {
      missing: 'found it!',
      str: 'should not see this',
    };

    expect(responseToObject(body, keys, defaults)).toEqual({
      str: 'hi',
      missing: 'found it!',
    });
  });
});
