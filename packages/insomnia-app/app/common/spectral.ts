import { IRuleResult, Spectral } from '@stoplight/spectral-core';

export const initializeSpectral = () => new Spectral();

export const isLintError = (result: IRuleResult) => result.severity === 0;
