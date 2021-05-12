import CodeMirror from 'codemirror';
import { Spectral } from '@stoplight/spectral';

const spectral = new Spectral();

CodeMirror.registerHelper('lint', 'openapi', async function(text) {
  const results = await spectral.run(text);
  return results.map(result => ({
    // @ts-expect-error -- TSCONVERSION
    from: CodeMirror.Pos(result.range.start.line, result.range.start.chracter),
    // @ts-expect-error -- TSCONVERSION
    to: CodeMirror.Pos(result.range.end.line, result.range.end.chracter),
    message: result.message,
  }));
});
