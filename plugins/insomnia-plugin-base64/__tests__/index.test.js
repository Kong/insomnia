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
  it('encodes nothing', assertTemplate(['encode'], ''));
  it('encodes something', assertTemplate(['encode', 'my string'], 'bXkgc3RyaW5n'));
  it('decodes nothing', assertTemplate(['decode'], ''));
  it('decodes something', assertTemplate(['decode', 'bXkgc3RyaW5n'], 'my string'));
  it(
    'fails on invalid op',
    assertTemplateFails(['foo'], 'Unsupported operation "foo". Must be encode or decode.')
  );
});
