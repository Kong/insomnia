import { IRuleResult, isOpenApiv2, isOpenApiv3, Spectral } from '@stoplight/spectral';

export const initializeSpectral = () => {
  const spectral = new Spectral();
  spectral.registerFormat('oas2', isOpenApiv2);
  spectral.registerFormat('oas3', isOpenApiv3);
  spectral.loadRuleset('spectral:oas');

  return spectral;
};

export const isLintError = (result: IRuleResult) => result.severity === 0;
