const tag = require('..').templateTags[0];

function assertTemplate(args, expected) {
  return async function() {
    const result = await tag.run(null, ...args);
    expect(result).toBe(expected);
  };
}

function assertTemplateFails(args, expected) {
  return async function() {
    try {
      await tag.run(null, ...args);
      fail(`Render should have thrown ${expected}`);
    } catch (err) {
      expect(err.message).toContain(expected);
    }
  };
}

describe('Base64EncodeExtension', () => {
  it('encodes nothing', assertTemplate(['encode', 'normal', ''], ''));
  it('encodes something', assertTemplate(['encode', 'normal', 'my string'], 'bXkgc3RyaW5n'));
  it('urlencodes nothing', assertTemplate(['encode', 'url', ''], ''));
  it('urlencodes something', assertTemplate(['encode', 'url', 'hello world'], 'aGVsbG8gd29ybGQ'));
  it('decodes nothing', assertTemplate(['decode', 'normal', ''], ''));
  it('decodes something', assertTemplate(['decode', 'normal', 'bXkgc3RyaW5n'], 'my string'));
  it('urldecodes nothing', assertTemplate(['decode', 'url', ''], ''));
  it('urldecodes something', assertTemplate(['decode', 'url', 'aGVsbG8gd29ybGQ'], 'hello world'));
  it(
    'fails on invalid action',
    assertTemplateFails(
      ['foo', 'normal', ''],
      'Unsupported operation "foo". Must be encode or decode.',
    ),
  );
});
