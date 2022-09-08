import { ApiSpecRuleset } from "../models/api-spec-ruleset";
import { IRuleResult, RulesetDefinition, Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
const { bundleAndLoadRuleset } = require("@stoplight/spectral-ruleset-bundler/with-loader");
import CodeMirror from 'codemirror';

export const initializeSpectral = async (providedRuleset?: ApiSpecRuleset) => {
  const spectral = new Spectral();
  if (providedRuleset) {
    const r: RulesetDefinition = await bundleAndLoadRuleset("file:///insomnia.custom-spectral-config.yaml", {
      fs: { promises: { readFile: () => { return providedRuleset.contents; }}  as any}
    })
    spectral.setRuleset(r);
  } else {
    spectral.setRuleset(oas as RulesetDefinition);
  }

  CodeMirror.registerHelper('lint', 'openapi', async function (text: string) {
    const results = await spectral.run(text);

    return results.map(result => ({
      from: CodeMirror.Pos(result.range.start.line, result.range.start.character),
      to: CodeMirror.Pos(result.range.end.line, result.range.end.character),
      message: result.message,
    }));
  });

  return spectral;
};

export const isLintError = (result: IRuleResult) => result.severity === 0;