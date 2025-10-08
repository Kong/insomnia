/* eslint-disable no-undef */
console.log('[git-commit-generation-process] Mock generation worker started');

process.on('uncaughtException', error => {
  console.error('[git-commit-generation-process] Uncaught exception:', error);
  process.parentPort.postMessage({ error: error.message });
});

process.parentPort.on('message', async ({ data: { input, modelConfig, aiPluginName } }) => {
  try {
    const { generateCommitsFromDiff } = await import(aiPluginName);
    const commits = await generateCommitsFromDiff(input, modelConfig);

    console.log('[git-commit-generation-process] Successfully generated routes');
    process.parentPort.postMessage({ commits });
  } catch (error) {
    const errorMessage = 'Failed to generate git commits: ' + error.message;
    console.error('[git-commit-generation-process]', errorMessage);
    process.parentPort.postMessage({ error: errorMessage });
  }
});
