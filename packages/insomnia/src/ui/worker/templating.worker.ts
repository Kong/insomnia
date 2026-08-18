import { fetchFromTemplateWorkerDatabase, setTemplatingDbAuthToken } from '~/common/templating/liquid-extension-worker';
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
  const data = JSON.parse(event.data);
  // This Worker builds and caches its own Liquid engine (see `~/ui/templating/worker`), including
  // the plugin tags baked into it — a "reload" message is the only way to invalidate that cache
  // from outside the worker thread. Without it, a plugin that's missing when the engine is first
  // built (e.g. a plugin-discovery race) is locked out of every render for the rest of the session,
  // regardless of how many times the user clicks "Reload". The plugin
  // registry this worker fetches tags from (in main) also caches independently of the Settings
  // page's own copy, so it has to be told to rescan too — see `plugin.reloadPlugins`.
  if (data.type === 'reload') {
    // This worker's own auth token is normally set below, from a render job's payload — but reload
    // can be the very first message this worker ever receives (e.g. Reload clicked before any
    // request has been sent this session), so it carries its own token rather than relying on that.
    setTemplatingDbAuthToken(data.authToken ?? null);
    await fetchFromTemplateWorkerDatabase('plugin.reloadPlugins', {});
    templating.reload();
    return;
  }

  const { id, input, context, path, ignoreUndefinedEnvVariable, authToken } = data;
  // This Worker has its own copy of the module-scoped auth token, set from the message.
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
