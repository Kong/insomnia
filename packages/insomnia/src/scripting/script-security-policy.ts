import { invariant } from '../utils/invariant';
import { requireInterceptor } from './require-interceptor';
import type { ThreatRule } from './script-security-rules';
export type { ASTRule, ThreatRule } from './script-security-rules';
export { blockedPropertyRules, blockedRootRules, maskRules } from './script-security-rules';

// mask interceptor binding rules.
export const interceptorRules: ThreatRule[] = [
  {
    name: 'require',
    description: 'Replaces the require() function with an interceptor to prevent access to modules outside an explicit allowlist.',
    maskName: 'require',
    maskValue: requireInterceptor,
  },
  {
    name: 'window',
    description: 'Replaces the window object with a restricted proxy to prevent access to host APIs beyond the three bridge methods the script executor requires.',
    maskName: 'window',
    buildMaskValue: _violationCheck => {
      if (typeof window === 'undefined') {
        return;
      }
      const allowedBridgeMethods = new Set<string | symbol>([
        'resetAsyncTasks',
        'stopMonitorAsyncTasks',
        'asyncTasksAllSettled',
      ]);
      const bridgeProxy = new Proxy(window.bridge, {
        get(target, prop: string | symbol) {
          if (allowedBridgeMethods.has(prop)) {
            return Reflect.get(target, prop);
          }
          return;
        },
      });
      return new Proxy(window, {
        get(_target, prop: string | symbol) {
          if (prop === 'bridge') {
            return bridgeProxy;
          }
          return;
        },
      });
    },
  },
  {
    name: 'eval',
    description: 'Replaces the eval() function with an interceptor to prevent execution of scripts containing sandbox violations.',
    maskName: 'eval',
    buildMaskValue: violationCheck => (script: string) => {
      invariant(script && typeof script === 'string', 'eval is called with invalid or empty value');
      violationCheck(script);


      return (0, eval)(script);
    },
  },
];
