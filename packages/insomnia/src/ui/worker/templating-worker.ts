import * as templating from '../../templating/worker';

const originalRequire = self.require;
const interceptor: any = (moduleName: string): NodeRequire => {
  const allowList = ['crypto', 'date-fns', 'fs', 'iconv-lite', 'jsonpath-plus', 'os', 'tough-cookie', 'uuid'];
  if (allowList.includes(moduleName)) {
    return originalRequire(moduleName);
  }
  throw new Error(
    `Cannot find module '${moduleName}', untrusted modules are not available in protected mode, this can be enabled in plugin settings`,
  );
};
async function performJob(input: {
  input: string;
  context: Record<string, any>;
  path: string;
  ignoreUndefinedEnvVariable: boolean;
}) {
  self.require = interceptor;
  return templating.render(input.input, {
    context: input.context,
    path: input.path,
    ignoreUndefinedEnvVariable: input.ignoreUndefinedEnvVariable,
  });
}

// Listen for messages from the main thread
self.onmessage = async event => {
  const { id, input, context, path, ignoreUndefinedEnvVariable } = JSON.parse(event.data);
  try {
    context.getMeta = () => ({
      requestId: context.serializedFunctions.requestId,
      workspaceId: context.serializedFunctions.workspaceId,
    });
    context.getEnvironmentId = () => context.serializedFunctions.environmentId;
    context.getExtraInfo = () => context.serializedFunctions.extraInfo;
    context.getGlobalEnvironmentId = () => context.serializedFunctions.globalEnvironmentId;
    context.getKeysContext = () => context.serializedFunctions.keysContext;
    context.getProjectId = () => context.serializedFunctions.projectId;
    context.getPurpose = () => context.serializedFunctions.purpose;
    const result = await performJob({ input, context, path, ignoreUndefinedEnvVariable });
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, err });
  }
};
