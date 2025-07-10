/* eslint-disable no-undef */
console.log('Lint worker started');
import fs from 'node:fs';

import Spectral from '@stoplight/spectral-core';
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import spectralRuntime from '@stoplight/spectral-runtime';
process.on('uncaughtException', (error) => {
  console.error(error);
});

process.parentPort.on('message', async ({ data: { documentContent, rulesetPath } }) => {
  try {
    console.log('Linting document content');
    const spectral = new Spectral.Spectral();
    const { fetch } = spectralRuntime;
    const ruleset = rulesetPath ? await bundleAndLoadRuleset(rulesetPath, { fs, fetch, }) : oas;
    spectral.setRuleset(ruleset);
    console.log('Ruleset loaded:', rulesetPath || 'default OAS ruleset');
    const results = await spectral.run(documentContent);
    process.parentPort.postMessage(results);
  } catch (err) {
    process.parentPort.postMessage({ error: err.message });
  }
});

