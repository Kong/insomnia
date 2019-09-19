import CodeMirror from 'codemirror';
import { Spectral } from '@stoplight/spectral';

const spectral = new Spectral();

CodeMirror.registerHelper('lint', 'openapi', async function(text) {
  const found = [];
  const results = await spectral.run(text);

  results.forEach(result => {
    found.push({
      from: CodeMirror.Pos(result.range.start.line, result.range.start.chracter),
      to: CodeMirror.Pos(result.range.end.line, result.range.end.chracter),
      message: result.message,
    });
  });
  return found;
});
