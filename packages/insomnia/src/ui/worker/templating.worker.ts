import { setTemplatingDbAuthToken } from '~/common/templating/liquid-extension-worker';
import { deserializeRenderContext } from '~/common/templating/render-context-serialization';
import * as templating from '~/ui/templating/worker';

async function performJob(input: {
  input: string;
  context: Record<string, any>;
  path: string;
  ignoreUndefinedEnvVariable: boolean;
}) {
  return templating.render(input.input, {
    context: input.context,
    path: input.path,
    ignoreUndefinedEnvVariable: input.ignoreUndefinedEnvVariable,
  });
}

// Listen for messages from the main thread
self.onmessage = async event => {
  const { id, input, context, path, ignoreUndefinedEnvVariable, authToken } = JSON.parse(event.data);
  // F1: this Worker is a separate JS realm from the window that spawned it (`templating-handler.ts`),
  // so it has its own copy of the module-scoped auth token — set it from the message rather than
  // trying to reach `window.main` (unavailable here).
  setTemplatingDbAuthToken(authToken ?? null);
  try {
    const result = await performJob({
      input,
      context: deserializeRenderContext(context),
      path,
      ignoreUndefinedEnvVariable,
    });
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, err });
  }
};
