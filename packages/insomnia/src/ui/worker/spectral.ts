import type { Ruleset, RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';

interface SpectralRunParams {
  contents: string;
  ruleset?: Ruleset;
}

// onconnect = event => {
//   const port = event.ports[0];

//   port.onmessage = e => {
//     port.postMessage('1');
//     // new Spectral();
//     port.postMessage('2');
//   };
// };

const spectralRun = async ({ contents, ruleset }: SpectralRunParams) => {
  try {
    const spectral = new Spectral();
    spectral.setRuleset(ruleset || oas as RulesetDefinition);

    const diagnostics = await spectral.run(contents);

    postMessage(diagnostics);
  } catch (err) {
    postMessage([]);
  }
};

onmessage = async e => {
  spectralRun(e.data);
};
