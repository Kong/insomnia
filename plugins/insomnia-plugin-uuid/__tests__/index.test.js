const tag = require('..').templateTags[0];

function assertTemplate(args, expected) {
  return async function() {
    const result = await tag.run(null, ...args);
    if (expected instanceof RegExp) {
      expect(result).toMatch(expected);
    } else {
      expect(result).toBe(expected);
    }
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

const UUID_RE = /[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}/;

describe('UuidExtension', () => {
  it('renders default v4', assertTemplate([], UUID_RE));
  it('renders 4', assertTemplate(['4'], UUID_RE));
  it('renders 4 num', assertTemplate([4], UUID_RE));
  it('renders v4', assertTemplate(['v4'], UUID_RE));
  it('renders 1', assertTemplate(['1'], UUID_RE));
  it('renders 1 num', assertTemplate([1], UUID_RE));
  it('renders v1', assertTemplate(['v1'], UUID_RE));
  it('fails on other', assertTemplateFails(['foo'], 'Invalid UUID type "foo"'));
});
