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
  const { id, input, context, path, ignoreUndefinedEnvVariable } = JSON.parse(event.data);
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
