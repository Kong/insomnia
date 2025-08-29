/* eslint-disable no-undef */
console.log('[lint-process] Lint worker started');
import fs from 'node:fs';

import Spectral from '@stoplight/spectral-core';
import { bundleAndLoadRuleset } from '@stoplight/spectral-ruleset-bundler/with-loader';
import { oas } from '@stoplight/spectral-rulesets';
import spectralRuntime from '@stoplight/spectral-runtime';
process.on('uncaughtException', error => {
  console.error(error);
});

process.parentPort.on('message', async ({ data: { documentContent, rulesetPath } }) => {
  let hasValidCustomRuleset = false;
  if (rulesetPath) {
    try {
      (await fs.promises.stat(rulesetPath)).isFile();
      hasValidCustomRuleset = true;
    } catch {}
  }
  try {
    const spectral = new Spectral.Spectral();
    const { fetch } = spectralRuntime;
    const ruleset = hasValidCustomRuleset ? await bundleAndLoadRuleset(rulesetPath, { fs, fetch }) : oas;
    spectral.setRuleset(ruleset);
    console.log('[lint-process] Ruleset loaded:', rulesetPath || 'default OAS ruleset');
    const diagnostics = await spectral.run(documentContent);
    process.parentPort.postMessage({ diagnostics });
  } catch (err) {
    process.parentPort.postMessage({ error: err.message });
  }
});
