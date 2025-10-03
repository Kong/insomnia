/* eslint-disable no-undef */
console.log('[mock-generation-process] Mock generation worker started');

process.on('uncaughtException', error => {
  console.error('[mock-generation-process] Uncaught exception:', error);
  process.parentPort.postMessage({ error: error.message });
});

process.parentPort.on('message', async ({ data: { openApiSpec, specUrl, specText, modelConfig, useDynamicMockResponses, mockServerAdditionalFiles, aiPluginName } }) => {
  try {
    let routes;

    if (openApiSpec) {
      const { generateMockRouteDataFromOpenAPISpec } = await import(aiPluginName);
      routes = await generateMockRouteDataFromOpenAPISpec(openApiSpec, modelConfig, {
        additionalFiles: mockServerAdditionalFiles,
        useDynamicMockResponses: useDynamicMockResponses,
      });
    } else if (specUrl) {
      const { generateMockRouteDataFromUrl } = await import(aiPluginName);
      routes = await generateMockRouteDataFromUrl(specUrl, modelConfig, {
        additionalFiles: mockServerAdditionalFiles,
        useDynamicMockResponses: useDynamicMockResponses,
      });
    } else if (specText) {
      const { generateMockRouteDataFromText } = await import(aiPluginName);
      routes = await generateMockRouteDataFromText(specText, modelConfig, {
        additionalFiles: mockServerAdditionalFiles,
        useDynamicMockResponses: useDynamicMockResponses,
      });
    } else {
      const errorMessage = 'No spec source was provided';
      console.error('[mock-generation-process]', errorMessage);
      process.parentPort.postMessage({ error: errorMessage });
      return;
    }

    console.log('[mock-generation-process] Successfully generated routes');
    process.parentPort.postMessage({ routes });
  } catch (error) {
    const errorMessage = 'Failed to generate mock routes: ' + error.message;
    console.error('[mock-generation-process]', errorMessage);
    process.parentPort.postMessage({ error: errorMessage });
  }
});
