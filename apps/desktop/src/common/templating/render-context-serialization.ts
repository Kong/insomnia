// The render context carries helper functions (getMeta, getProjectId, getSettings, ...) alongside
// the environment data. Functions cannot cross a process/worker boundary — structured clone (IPC)
// rejects them with "An object could not be cloned", and JSON.stringify silently drops them.
//
// `serializeRenderContext` resolves those helpers into a plain `serializedFunctions` bag and strips
// the functions, leaving a cloneable object. `deserializeRenderContext` rebuilds the helpers on the
// far side. Shared by the templating web worker bridge and the plugin-hook IPC bridge.

export interface SerializedRenderFunctions {
  requestId?: string;
  workspaceId?: string;
  environmentId?: string;
  extraInfo?: any;
  globalEnvironmentId?: string;
  keysContext?: any;
  projectId?: string;
  purpose?: any;
  settings?: any;
}

export function serializeRenderContext(context: Record<string, any>): Record<string, any> {
  const meta = context.getMeta?.() || {};
  const serializedFunctions: SerializedRenderFunctions = {
    requestId: meta.requestId,
    workspaceId: meta.workspaceId,
    environmentId: context.getEnvironmentId?.(),
    extraInfo: context.getExtraInfo?.(),
    globalEnvironmentId: context.getGlobalEnvironmentId?.(),
    keysContext: context.getKeysContext?.(),
    projectId: context.getProjectId?.(),
    purpose: context.getPurpose?.(),
    settings: context.getSettings?.(),
  };
  // Drop function-valued properties so the result is structured-clone safe.
  const dataOnly = Object.fromEntries(Object.entries(context).filter(([, value]) => typeof value !== 'function'));
  return { ...dataOnly, serializedFunctions };
}

export function deserializeRenderContext(context: Record<string, any>): Record<string, any> {
  const serializedFunctions: SerializedRenderFunctions = context.serializedFunctions || {};
  return {
    ...context,
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
