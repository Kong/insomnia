import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../../templating';
import { checkNestedKeys, ensureKeyIsValid } from '../environment-editor';

describe('ensureKeyIsValid()', () => {
  it.each([
    '$',
    '$a',
    '$ab',
  ])('"%s" should be invalid when key begins with $', key => {
    expect(ensureKeyIsValid(key, false)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each([
    '.',
    'a.',
    '.a',
    'a.b',
  ])('"%s" should be invalid when key contains .', key => {
    expect(ensureKeyIsValid(key, false)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each([
    '$a.b',
    '$.',
  ])('"%s" should be invalid when key starts with $ and contains .', key => {
    expect(ensureKeyIsValid(key, false)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each([
    '_',
  ])('"%s" should be invalid when key is _', key => {
    expect(ensureKeyIsValid(key, true)).toBe(`"${key}" is a reserved key`);
  });

  it.each([
    '_',
    'a',
    'ab',
    'a$',
    'a$b',
    'a-b',
    `a${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}b`,
    `${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}ab`,
  ])('"%s" should be valid as a nested key', key => {
    expect(ensureKeyIsValid(key, false)).toBe(null);
  });

  it.each([
    'a',
    'ab',
    'a$',
    'a$b',
    'a-b',
    `a${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}b`,
    `${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}ab`,
  ])('"%s" should be valid as a root value', key => {
    expect(ensureKeyIsValid(key, true)).toBe(null);
  });
});

describe('checkNestedKeys()', () => {
  it('should check root property and error', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      '$nes.ted': {
        'path-with-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          'second': 'second',
        },
        {
          'third': 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe('"$nes.ted" cannot begin with \'$\' or contain a \'.\'');
  });

  it('should check nested property and error', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      'nested': {
        '$path-wi.th-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          'second': 'second',
        },
        {
          'third': 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe('"$path-wi.th-hyphens" cannot begin with \'$\' or contain a \'.\'');
  });

  it('should check for complex objects inside array', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      'nested': {
        'path-with-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          'second': 'second',
        },
        {
          'thi.rd': 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe('"thi.rd" cannot begin with \'$\' or contain a \'.\'');
  });

  it('should check nested properties and pass', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      'nested': {
        'path-with-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          'second': 'second',
        },
        {
          'third': 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe(null);
  });
});
