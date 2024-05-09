import type { RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
// @ts-expect-error - need to modify moduleResolution option in tsconfig
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import fs from 'fs';

interface SpectralRunParams {
  contents: string;
  rulesetPath: string;
  taskId: number;
}

const loadRuleset = async (rulesetPath: string) => {
  let ruleset = oas as RulesetDefinition;

  if (rulesetPath) {
    try {
      ruleset = await bundleAndLoadRuleset(rulesetPath, {
        fs,
        fetch,
      });

    } catch (err) {
      console.log('Error while parsing ruleset:', err);
    }
  }

  return ruleset;
};

const spectralRun = async ({ contents, rulesetPath, taskId }: SpectralRunParams) => {
  try {
    const spectral = new Spectral();
    const ruleset = await loadRuleset(rulesetPath);
    spectral.setRuleset(ruleset);

    const diagnostics = await spectral.run(contents);

    postMessage({
      id: taskId,
      diagnostics,
    });
  } catch (err) {
    postMessage(err);
  }
};

onmessage = async e => {
  spectralRun(e.data);
};
