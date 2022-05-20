import { IRuleResult, Ruleset, Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';

export const initializeSpectral = () => {
  const spectral = new Spectral();
  spectral.setRuleset(oas as unknown as Ruleset);
  return spectral;
};

export const isLintError = (result: IRuleResult) => result.severity === 0;
