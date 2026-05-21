import type { RenderTemplateArgs } from './plugins/bridge-types';
import * as templating from './templating/worker';

interface RenderTemplateWorkerRequest {
  id: string;
  type: 'render';
  args: RenderTemplateArgs;
}

interface ReloadTemplateWorkerRequest {
  id: string;
  type: 'reload';
}

type TemplateWorkerRequest = RenderTemplateWorkerRequest | ReloadTemplateWorkerRequest;

function serializeWorkerError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...Object.fromEntries(Object.entries(error)),
  };
}

function rehydrateRenderContext(context: RenderTemplateArgs['context']) {
  const { serializedFunctions, ...renderContext } = context;

  return {
    ...renderContext,
    getMeta: () => ({
      requestId: serializedFunctions.requestId,
      workspaceId: serializedFunctions.workspaceId,
    }),
    getEnvironmentId: () => serializedFunctions.environmentId,
    getExtraInfo: () => serializedFunctions.extraInfo,
    getGlobalEnvironmentId: () => serializedFunctions.globalEnvironmentId,
    getKeysContext: () => serializedFunctions.keysContext,
    getProjectId: () => serializedFunctions.projectId,
    getPurpose: () => serializedFunctions.purpose,
    getSettings: () => serializedFunctions.settings,
  };
}

globalThis.onmessage = async (event: MessageEvent<TemplateWorkerRequest>) => {
  const data = event.data;

  try {
    if (data.type === 'reload') {
      templating.reload();
      globalThis.postMessage({ id: data.id, result: null });
      return;
    }

    const { input, context, path, ignoreUndefinedEnvVariable } = data.args;
    const result = await templating.render(input, {
      context: rehydrateRenderContext(context),
      path,
      ignoreUndefinedEnvVariable,
    });
    globalThis.postMessage({ id: data.id, result });
  } catch (error) {
    globalThis.postMessage({ id: data.id, error: serializeWorkerError(error) });
  }
};
