import path from 'path';
import * as templating from '../../index';
import {globalBeforeEach} from '../../../__jest__/before-each';

function assertTemplate (txt, context, expected) {
  return async function () {
    const result = await templating.render(txt, {context});
    expect(result).toMatch(expected);
  };
}

function assertTemplateFails (txt, context, expected) {
  return async function () {
    try {
      await templating.render(txt, {context});
      fail(`Render should have thrown ${expected}`);
    } catch (err) {
      expect(err.message).toContain(expected);
    }
  };
}

describe('FileExtension', () => {
  beforeEach(globalBeforeEach);
  const ctx = {path: path.resolve(__dirname, path.join('./test.txt'))};
  const escapedPath = ctx.path.replace(/\\/g, '\\\\');
  it('reads from string', assertTemplate(`{% file "${escapedPath}" %}`, ctx, 'Hello World'));
  it('reads a file correctly', assertTemplate('{% file path %}', ctx, 'Hello World!'));
  it('fails on missing file', assertTemplateFails('{% file "/foo" %}', ctx, `ENOENT: no such file or directory, open '${path.resolve('/foo')}'`));
  it('fails on no 2nd param', assertTemplateFails('{% file %}', ctx, 'No file selected'));
  it('fails on unknown variable', assertTemplateFails('{% file foo %}', ctx, 'No file selected'));
});
