const path = require('path');
const tag = require('..').templateTags[0];

function assertTemplate (args, expected) {
  return async function () {
    const result = await tag.run(null, ...args);
    expect(result).toBe(expected);
  };
}

function assertTemplateFails (args, expected) {
  return async function () {
    try {
      await tag.run(null, ...args);
      fail(`Render should have thrown ${expected}`);
    } catch (err) {
      expect(err.message).toContain(expected);
    }
  };
}

describe('FileExtension', () => {
  const filename = path.resolve(__dirname, path.join('./test.txt'));
  const escaped = filename.replace(/\\/g, '\\\\');
  it('reads from string', assertTemplate([escaped], 'Hello World!'));
  it('fails on missing file', assertTemplateFails(['/foo'], `ENOENT: no such file or directory, open '${path.resolve('/foo')}'`));
  it('fails on no 2nd param', assertTemplateFails([], 'No file selected'));
});
