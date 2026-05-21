import type { RenderTemplateArgs } from '~/plugins/bridge-types';
import { plugins } from '~/plugins/renderer-bridge';

import { extractUndefinedVariableKey, RenderError } from '../../templating/render-error';
import type { RenderInputType } from '../../templating/types';

function serializeRenderContext(context: RenderInputType['context']): RenderTemplateArgs['context'] {
  // Omit function-valued properties: Electron IPC uses structured clone which cannot serialize functions.
  // Functions on BaseRenderContext (getMeta, getKeysContext, etc.) are captured into serializedFunctions instead.
  const dataEntries = Object.entries(context).filter(([, v]) => typeof v !== 'function');
  const dataContext = Object.fromEntries(dataEntries);

  return {
    ...dataContext,
    serializedFunctions: {
      requestId: context.getMeta().requestId,
      workspaceId: context.getMeta().workspaceId,
      environmentId: context.getEnvironmentId(),
      extraInfo: context.getExtraInfo(),
      globalEnvironmentId: context.getGlobalEnvironmentId(),
      keysContext: context.getKeysContext(),
      projectId: context.getProjectId(),
      purpose: context.getPurpose(),
      settings: context.getSettings(),
    },
  };
}

function normalizeRenderError(error: unknown, input: string, context: RenderTemplateArgs['context']) {
  const source = error instanceof Error ? error : new Error(String(error));
  const renderError = new RenderError(source.message);
  const errorDetails = source as RenderError;

  renderError.path = errorDetails.path || '';
  renderError.location = errorDetails.location ?? { line: 1, column: 1 };
  renderError.type = errorDetails.type || 'render';
  renderError.reason = errorDetails.reason ?? 'error';

  if (errorDetails.extraInfo) {
    renderError.extraInfo = errorDetails.extraInfo;
    return renderError;
  }

  const undefinedEnvironmentVariables = extractUndefinedVariableKey(input, context);
  if (undefinedEnvironmentVariables.length > 0) {
    renderError.extraInfo = {
      subType: 'environmentVariable',
      undefinedEnvironmentVariables,
    };
  }

  return renderError;
}

export async function renderViaPluginBridge({
  input,
  context,
  path,
  ignoreUndefinedEnvVariable,
}: RenderInputType): Promise<string> {
  const serializedContext = serializeRenderContext(context);

  try {
    return await plugins.renderTemplate({
      input,
      context: serializedContext,
      path,
      ignoreUndefinedEnvVariable,
    });
  } catch (error) {
    throw normalizeRenderError(error, input, serializedContext);
  }
}
