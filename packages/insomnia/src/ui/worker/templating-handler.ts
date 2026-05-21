import type { RenderTemplateArgs } from '~/plugins/bridge-types';
import { plugins } from '~/plugins/renderer-bridge';

import { extractUndefinedVariableKey, RenderError } from '../../templating/render-error';
import type { RenderInputType } from '../../templating/types';

function serializeRenderContext(context: RenderInputType['context']): RenderTemplateArgs['context'] {
  return {
    ...context,
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
  renderError.location = errorDetails.location;
  renderError.type = errorDetails.type || 'render';
  renderError.reason = errorDetails.reason;

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

export async function renderInWorker({
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
