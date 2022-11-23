import type { IRuleResult } from '@stoplight/spectral-core';
import CodeMirror from 'codemirror';

CodeMirror.registerHelper('lint', 'openapi', async function(text: string) {
  const isLintError = (result: IRuleResult) => result.severity === 0;

  const run = await window.main.spectralRun(text);
  return run.filter(isLintError).map(result => ({
    from: CodeMirror.Pos(result.range.start.line, result.range.start.character),
    to: CodeMirror.Pos(result.range.end.line, result.range.end.character),
    message: result.message,
  }));
});
