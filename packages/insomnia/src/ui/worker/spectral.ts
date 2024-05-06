import type { RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import fs from 'fs';

interface SpectralRunParams {
  contents: string;
  rulesetPath?: string;
}

const spectralRun = async ({ contents, rulesetPath }: SpectralRunParams) => {
  const spectral = new Spectral();

  if (rulesetPath) {
    try {
      console.log('start -----');
      debugger;
      const ruleset = await bundleAndLoadRuleset(rulesetPath, {
        fs,
        fetch,
      });
      console.log('end ---------');

      spectral.setRuleset(ruleset);
    } catch (err) {
      postMessage(err);
      console.log('Error while parsing ruleset:', err);
      spectral.setRuleset(oas as RulesetDefinition);
    }
  } else {
    spectral.setRuleset(oas as RulesetDefinition);
  }

  const diagnostics = await spectral.run(contents);

  postMessage(diagnostics);
};

onmessage = async e => {
  spectralRun(e.data);
};
