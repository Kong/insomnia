import type { RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
// @ts-expect-error - This is a bundled file not sure why it's not found
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import fs from 'fs';

import { axiosRequest } from '../network/axios-request';

export const spectralRun = async ({ contents, rulesetPath }: {
  contents: string;
  rulesetPath?: string;
}) => {
  const spectral = new Spectral();

  if (rulesetPath) {
    try {
      const ruleset = await bundleAndLoadRuleset(rulesetPath, {
        fs,
        fetch: (url: string) => {
          return axiosRequest({ url, method: 'GET' });
        },
      });

      spectral.setRuleset(ruleset);
    } catch (err) {
      console.log('Error while parsing ruleset:', err);
      spectral.setRuleset(oas as RulesetDefinition);
    }
  } else {
    spectral.setRuleset(oas as RulesetDefinition);
  }

  const diagnostics = await spectral.run(contents);

  return diagnostics;
};
