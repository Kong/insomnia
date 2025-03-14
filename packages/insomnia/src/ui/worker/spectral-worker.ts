import type { ISpectralDiagnostic, RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
// @ts-expect-error - tsconfig needs to be updated to separate main/renderer code
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import fs from 'fs';

interface SpectralRunParams {
  contents: string;
  rulesetPath: string;
  taskId: number;
}

export interface SpectralResponse {
  id: number;
  diagnostics: ISpectralDiagnostic[];
}

const cachedRuleset: {
  path: string;
  ruleset: RulesetDefinition;
} = {
  path: '',
  ruleset: oas as RulesetDefinition,
};

const loadRuleset = async (rulesetPath: string) => {
  if (cachedRuleset.path === rulesetPath) {
    return cachedRuleset.ruleset;
  }

  let ruleset = oas as RulesetDefinition;

  if (rulesetPath) {
    try {
      ruleset = await bundleAndLoadRuleset(rulesetPath, {
        fs,
        fetch,
      });

      cachedRuleset.path = rulesetPath;
      cachedRuleset.ruleset = ruleset;
    } catch (err) {
      console.log('[spectral] Error while parsing ruleset:', err);
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
