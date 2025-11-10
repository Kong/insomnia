/* eslint-disable no-undef */
console.log('[mcp-generate-sampling-response-process] Sampling response generation worker started');

process.on('uncaughtException', error => {
  console.error('[mcp-generate-sampling-response-process] Uncaught exception:', error);
  process.parentPort.postMessage({ error: error.message });
});

process.parentPort.on('message', async ({ data: { messages, systemPrompt, modelConfig, aiPluginName } }) => {
  try {
    const { generateMcpSamplingResponse } = await import(aiPluginName);
    const response = await generateMcpSamplingResponse(messages, systemPrompt, modelConfig);
    console.log('[mcp-generate-sampling-response-process] Successfully generate sampling responses');
    process.parentPort.postMessage(response);
  } catch (error) {
    const errorMessage = 'Failed to generate git commits: ' + error.message;
    console.error('[mcp-generate-sampling-response-process]', errorMessage);
    process.parentPort.postMessage({ error: errorMessage });
  }
});
