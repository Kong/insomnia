import * as templating from '../../index';

function assertTemplate (txt, expected) {
  return async function () {
    const result = await templating.render(txt);
    expect(result).toMatch(expected);
  };
}

function assertTemplateFails (txt, expected) {
  return async function () {
    try {
      await templating.render(txt);
      fail(`Render should have thrown ${expected}`);
    } catch (err) {
      expect(err.message).toBe(expected);
    }
  };
}

describe('UuidExtension', () => {
  it('renders default v4', assertTemplate('{% uuid %}', 'dd2ccc1a-2745-477a-881a-9e8ef9d42403'));
  it('renders 4', assertTemplate('{% uuid "4" %}', 'e3e96e5f-dd68-4229-8b66-dee1f0940f3d'));
  it('renders 4 num', assertTemplate('{% uuid 4 %}', 'a262d22b-5fa8-491c-9bd9-58fba03e301e'));
  it('renders v4', assertTemplate('{% uuid "v4" %}', '2e7c2688-09ee-44b8-900d-5cbbaa7d3a19'));
  it('renders 1', assertTemplate('{% uuid "1" %}', 'f7272c80-f493-11e6-bc64-92361f002671'));
  it('renders 1 num', assertTemplate('{% uuid 1 %}', 'f7272f0a-f493-11e6-bc64-92361f002671'));
  it('renders v1', assertTemplate('{% uuid "v1" %}', 'f72733a6-f493-11e6-bc64-92361f002671'));
  it('fails on other', assertTemplateFails('{% uuid "foo" %}', 'Invalid UUID type "foo"'));
});
