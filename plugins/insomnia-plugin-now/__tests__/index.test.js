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

const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
const secondsRe = /^\d{10}$/;
const millisRe = /^\d{13}$/;

describe('NowExtension', () => {
  it('renders default ISO', assertTemplate([], isoRe));
  it('renders ISO-8601', assertTemplate(['ISO-8601'], isoRe));
  it('renders seconds', assertTemplate(['seconds'], secondsRe));
  it('renders s', assertTemplate(['s'], secondsRe));
  it('renders unix', assertTemplate(['unix'], secondsRe));
  it('renders millis', assertTemplate(['millis'], millisRe));
  it('renders ms', assertTemplate(['ms'], millisRe));
  it('fails on other', assertTemplateFails(['foo'], 'Invalid date type "foo"'));
});
