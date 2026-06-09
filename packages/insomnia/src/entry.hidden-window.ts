import * as Sentry from '@sentry/electron/renderer';
import { SENTRY_OPTIONS } from 'insomnia/src/common/sentry';
import { initServices } from 'insomnia-data';

import type { RequestContext } from '../../insomnia-scripting-environment/src/objects';
import { initRuntime } from './common/runtime';
import { rendererRuntime } from './common/runtime/runtime.renderer';
import { runScript } from './scripting/run-script';
import { type ScriptSecurityPolicy } from './scripting/sandbox';

export interface HiddenBrowserWindowBridgeAPI {
  runScript: (options: {
    script: string;
    context: RequestContext;
    securityPolicy?: ScriptSecurityPolicy;
  }) => Promise<RequestContext>;
}

Sentry.init({
  ...SENTRY_OPTIONS,
});

// Initialize services for hidden renderer process
if (!window._dataServices) {
  throw new Error(
    'window._dataServices is not available. This entrypoint must run in an environment with the preload bridge.',
  );
}
initServices(window._dataServices);
// Remove the global services reference after initialization to improve security by preventing unintended access from the global scope.
delete window._dataServices;
initRuntime(rendererRuntime);

window.bridge.onmessage(
  async (data: { script: string; context: RequestContext }, callback: ({ error }: { error: string }) => void) => {
    window.bridge.setBusy(true);

    try {
      const timeout = data.context.timeout || 5000;
      const timeoutPromise = new window.bridge.Promise((resolve: ({ error }: { error: string }) => void) => {
        setTimeout(() => {
          resolve({ error: 'Timeout: Running script took too long' });
        }, timeout);
      });
      const result = await window.bridge.Promise.race([timeoutPromise, runScript(data)]);
      callback(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if ((error as NodeJS.ErrnoException).code === 'SECURITY_POLICY_VIOLATION') {
        console.log('[hidden-window] security policy violation:', error.message);
        callback({ error: error.message });
        return;
      }
      const errMessage = error.message
        ? `Error from Pre-request or after-response script:\n${error.message}`
        : String(error);
      const fullErrMessage = `${errMessage}\n\n${error.stack ? `Stack: ${error.stack}` : ''}`;
      console.log('[hidden-window] script error:', errMessage);
      Sentry.captureException(errMessage, {
        tags: {
          source: 'hidden-window',
        },
      });
      callback({ error: fullErrMessage });
    } finally {
      window.bridge.setBusy(false);
    }
  },
);
