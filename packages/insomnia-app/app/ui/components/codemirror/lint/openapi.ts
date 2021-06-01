import CodeMirror from 'codemirror';
import { isOpenApiv2, isOpenApiv3, Spectral } from '@stoplight/spectral';

const spectral = new Spectral();
spectral.registerFormat('oas2', isOpenApiv2);
spectral.registerFormat('oas3', isOpenApiv3);
spectral.loadRuleset('spectral:oas');

CodeMirror.registerHelper('lint', 'openapi', async function(text) {
  const results = (await spectral.run(text)).filter(result => (
    result.severity === 0 // filter for errors only
  ));

  return results.map(result => ({
    from: CodeMirror.Pos(result.range.start.line, result.range.start.character),
    to: CodeMirror.Pos(result.range.end.line, result.range.end.character),
    message: result.message,
  }));
});
