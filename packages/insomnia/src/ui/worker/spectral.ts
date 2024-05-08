import type { Ruleset } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';

interface SpectralRunParams {
  contents: string;
  ruleset: Ruleset;
  currentLintId: number;
}

const spectralRun = async ({ contents, ruleset, currentLintId }: SpectralRunParams) => {
  try {
    const spectral = new Spectral();
    spectral.setRuleset(ruleset);

    const diagnostics = await spectral.run(contents);

    postMessage({
      id: currentLintId,
      diagnostics,
    });
  } catch (err) {
    postMessage(err);
  }
};

onmessage = async e => {
  spectralRun(e.data);
};
