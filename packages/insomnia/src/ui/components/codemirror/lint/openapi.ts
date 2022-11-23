import type { IRuleResult, RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
import CodeMirror from 'codemirror';

const spectral = new Spectral();
spectral.setRuleset(oas as RulesetDefinition);

CodeMirror.registerHelper('lint', 'openapi', async function(text: string) {
  const isLintError = (result: IRuleResult) => result.severity === 0;
  const run = await spectral.run(text);

  return run.filter(isLintError).map(result => ({
    from: CodeMirror.Pos(result.range.start.line, result.range.start.character),
    to: CodeMirror.Pos(result.range.end.line, result.range.end.character),
    message: result.message,
  }));
});
