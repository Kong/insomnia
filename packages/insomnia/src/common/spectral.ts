import { IRuleResult, Ruleset, Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';

export const initializeSpectral = () => {
  const spectral = new Spectral();
  // @ts-expect-error -- TSCONVERSION oas not being properly caught as Ruleset
  spectral.setRuleset(oas as Ruleset);
  return spectral;
};

export const isLintError = (result: IRuleResult) => result.severity === 0;
