import type { IRuleResult } from '@stoplight/spectral';

export const initializeSpectral = async () => {
  const { isOpenApiv2, isOpenApiv3, Spectral } = await import('@stoplight/spectral');

  const spectral = new Spectral();
  spectral.registerFormat('oas2', isOpenApiv2);
  spectral.registerFormat('oas3', isOpenApiv3);
  spectral.loadRuleset('spectral:oas');

  return spectral;
};

export const isLintError = (result: IRuleResult) => result.severity === 0;
