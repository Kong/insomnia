import * as templating from '../../index';
import {globalBeforeEach} from '../../../__jest__/before-each';

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

describe('Base64EncodeExtension', () => {
  beforeEach(globalBeforeEach);
  it('encodes nothing', assertTemplate("{% base64 'encode' %}", ''));
  it('encodes something', assertTemplate("{% base64 'encode', 'my string' %}", 'bXkgc3RyaW5n'));
  it('decodes nothing', assertTemplate("{% base64 'decode' %}", ''));
  it('decodes something', assertTemplate("{% base64 'decode', 'bXkgc3RyaW5n' %}", 'my string'));
  it('fails on invalid op', assertTemplateFails(
    "{% base64 'foo' %}",
    'Unsupported operation "foo". Must be encode or decode.'
  ));
});
