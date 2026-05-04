import * as acorn from 'acorn';
import * as walk from "acorn-walk";

import {
  getNewConsole,
  initInsomniaObject,
  type RequestContext,
  waitForAllTestsDone,
} from '../../../insomnia-scripting-environment/src/objects';
import { blockedPropertyRules, blockedRootRules, interceptorRules, maskRules, type ThreatRule } from './script-security-policy';

// Frozen, pre-bound references to the bridge lifecycle methods 
export interface BridgeOps {
  resetAsyncTasks: () => void;
  stopMonitorAsyncTasks: () => void;
  asyncTasksAllSettled: () => Promise<void>;
  waitForAllTestsDone: () => Promise<void>;
}

export interface SandboxContext {
  executionContext: Awaited<ReturnType<typeof initInsomniaObject>>;
  scriptConsole: ReturnType<typeof getNewConsole>;
  maskNames: string[];
  maskValues: unknown[];
  bridgeOps: BridgeOps;
}

// Derive the default blocked sets from the canonical rule lists in script-security-policy.
const SANDBOX_BLOCKED_PROPERTIES = new Set(blockedPropertyRules.map(r => r.name));
const SANDBOX_BLOCKED_ROOTS = new Set(blockedRootRules.map(r => r.name));

// These interceptor rules always apply — they cannot be disabled via settings and run even when
// the sandbox is turned off, because they gate access to critical host APIs (require, window, eval).
const ALWAYS_ON_INTERCEPTORS = new Set(['require', 'window', 'eval']);

// Sentinel returned by getMemberPropertyName when the computed key cannot be statically resolved.
// Callers must treat this as a hard block — unknown dynamic keys are rejected by policy.
const UNRESOLVABLE = Symbol('unresolvable');

// Walks a MemberExpression down to its root Identifier.
function getMemberRoot(node: any): string | null {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') return getMemberRoot(node.object);
  return null;
}

// Returns MemberExpression property name, or UNRESOLVABLE when the computed key cannot be
// statically determined (e.g. BinaryExpression, dynamic TemplateLiteral). Returning null means
// the access is non-computed (impossible to be a blocked property via this path).
function getMemberPropertyName(node: acorn.MemberExpression): string | typeof UNRESOLVABLE | null {
  if (!node.computed && node.property.type === 'Identifier') {
    return (node.property as acorn.Identifier).name;
  }
  if (node.computed && node.property.type === 'Literal') {
    const val = (node.property as acorn.Literal).value;
    return typeof val === 'string' ? val : null;
  }
  // No-expression template literal: `constructor` has a statically known value.
  if (node.computed && node.property.type === 'TemplateLiteral') {
    const tl = node.property as any;
    if (tl.expressions.length === 0) {
      const cooked: string | null = tl.quasis[0].value.cooked;
      return cooked !== null ? cooked : UNRESOLVABLE;
    }
    return UNRESOLVABLE;
  }
  // Any other computed expression (BinaryExpression, CallExpression, etc.) cannot be verified.
  if (node.computed) {
    return UNRESOLVABLE;
  }
  return null;
}

// Recursively searches an expression for a blocked identifier or `this`.
// Returns the name of the first blocked identifier found, or null if none.
// Descends into LogicalExpression, ConditionalExpression, and SequenceExpression
// so that wrappers like `null || globalThis`, `false ? null : globalThis`, and
// `(0, globalThis)` are all detected and their alias propagated.
function extractBlockedIdentifier(
  expr: any,
  blocked: Map<string, string>,
  blockedRoots: Set<string>,
): string | null {
  if (!expr) return null;
  if (expr.type === 'Identifier') {
    return blocked.has(expr.name) ? expr.name : null;
  }
  if (expr.type === 'ThisExpression') {
    return blockedRoots.has('this') ? 'this' : null;
  }
  if (expr.type === 'LogicalExpression') {
    return extractBlockedIdentifier(expr.left, blocked, blockedRoots)
        ?? extractBlockedIdentifier(expr.right, blocked, blockedRoots);
  }
  if (expr.type === 'ConditionalExpression') {
    return extractBlockedIdentifier(expr.consequent, blocked, blockedRoots)
        ?? extractBlockedIdentifier(expr.alternate, blocked, blockedRoots);
  }
  if (expr.type === 'SequenceExpression') {
    for (const e of expr.expressions) {
      const hit = extractBlockedIdentifier(e, blocked, blockedRoots);
      if (hit !== null) return hit;
    }
  }
  return null;
}

function deepFreeze<T>(obj: T): T {
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as any)[name];
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

// parses `script` and checks for sandbox policy violations.
// Pass custom sets to apply per-rule overrides from user settings.
export function checkSandboxViolations(
  script: string,
  blockedProperties: Set<string> = SANDBOX_BLOCKED_PROPERTIES,
  blockedRoots: Set<string> = SANDBOX_BLOCKED_ROOTS,
  blockDynamic = true,
): void {
  let tree: any;
  for (const sourceType of ['module', 'script'] as const) {
    try {
      tree = acorn.parse(script, { ecmaVersion: 2022, sourceType });
      break;
    } catch {
      // try next sourceType
    }
  }
  // We should evenutally drop non-valid JavaScript.   
  if (!tree) {
    // throw new Error();
    return;
  }

  // Maps each blocked name to its root origin so error messages can explain alias chains.
  // e.g. `const s = this; s.x` → blocked.get('s') === 'this'
  const blocked = new Map<string, string>();
  for (const root of blockedRoots) {
    blocked.set(root, root);
  }

  // Helper: render a name with its origin chain if aliased (e.g. "'s' → 'this'").
  const label = (name: string) => {
    const origin = blocked.get(name);
    return origin && origin !== name ? `'${name}' → '${origin}'` : `'${name}'`;
  };

  // Helper: returns the specific rule name to tell the user to disable.
  // For aliases the root origin is the actual named rule; for direct roots it's the name itself.
  const ruleHint = (name: string) => {
    const origin = blocked.get(name) ?? name;
    return `'${origin}'`;
  };

  walk.simple(tree, {
    // const/let/var g = globalThis  OR  const s = this  OR  const g = null || globalThis
    VariableDeclarator(node: acorn.VariableDeclarator) {
      if (node.id.type !== 'Identifier') return;
      const id = node.id as acorn.Identifier;
      const foundName = extractBlockedIdentifier(node.init, blocked, blockedRoots);
      if (foundName !== null) {
        blocked.set(id.name, blocked.get(foundName) ?? foundName);
      }
    },
    // g = globalThis  OR  g = (0, globalThis)  OR  g = false ? null : globalThis
    AssignmentExpression(node: acorn.AssignmentExpression) {
      if (node.left.type !== 'Identifier') return;
      const id = node.left as acorn.Identifier;
      const foundName = extractBlockedIdentifier(node.right, blocked, blockedRoots);
      if (foundName !== null) {
        blocked.set(id.name, blocked.get(foundName) ?? foundName);
      }
    },
  });

  // check for violations using the fully expanded blocked map.
  walk.simple(tree, {
    MemberExpression(node: acorn.MemberExpression) {
      if (node.object.type === 'ThisExpression' && blockedRoots.has('this')) {
        throw new Error(
          `The script was blocked because it used 'this'.\n` +
          `If this is intended, disable it via Settings → Scripting → Blocked roots.`,
        );
      }

      // Covers dot and computed bracket notation via root chain traversal.
      const root = getMemberRoot(node.object);
      if (root && blocked.has(root)) {
        throw new Error(
          `The script was blocked because it used ${label(root)}.\n` +
          `If this is intended, disable ${ruleHint(root)} via Settings → Scripting → Blocked roots.`,
        );
      }

      // obj.constructor, obj['__proto__'], obj.getPrototypeOf, etc.
      const prop = getMemberPropertyName(node);
      if (prop === UNRESOLVABLE) {
        if (blockDynamic) {
          throw new Error(
            `The script was blocked because it used a dynamic computed property access that cannot be statically verified.\n` +
            `Use dot notation or a string literal key instead, or disable 'block unresolvable properties' via Settings → Scripting → Script Sandbox.`,
          );
        }
        return;
      }
      if (prop && blockedProperties.has(prop)) {
        throw new Error(
          `The script was blocked because it used the property '${prop}'.\n` +
          `If this is intended, disable '${prop}' via Settings → Scripting → Blocked properties.`,
        );
      }

      // Symbol.species: Promise[Symbol.species] / Array[Symbol.species].
      if (
        node.object.type === 'Identifier' &&
        (node.object as acorn.Identifier).name === 'Symbol' &&
        prop === 'species'
      ) {
        throw new Error(
          `The script was blocked because it used Symbol.species.\n` +
          `If this is intended, disable 'species' via Settings → Scripting → Blocked properties.`,
        );
      }
    },
    VariableDeclarator(node: acorn.VariableDeclarator) {
      if (node.id.type !== 'ObjectPattern') return;
      // Destructuring declaration: const { require } = globalThis
      if (
        node.init?.type === 'Identifier' &&
        blocked.has((node.init as acorn.Identifier).name)
      ) {
        const initName = (node.init as acorn.Identifier).name;
        throw new Error(
          `The script was blocked because it destructured from ${label(initName)}.\n` +
          `If this is intended, disable ${ruleHint(initName)} via Settings → Scripting → Blocked roots.`,
        );
      }
      // Destructuring from this: const { process } = this
      if (node.init?.type === 'ThisExpression' && blockedRoots.has('this')) {
        throw new Error(
          `The script was blocked because it destructured from 'this'.\n` +
          `If this is intended, disable it via Settings → Scripting → Blocked roots.`,
        );
      }
    },
    AssignmentExpression(node: acorn.AssignmentExpression) {
      // Destructuring assignment: ({ require } = globalThis)
      if (
        node.left.type === 'ObjectPattern' &&
        node.right.type === 'Identifier' &&
        blocked.has((node.right as acorn.Identifier).name)
      ) {
        const rightName = (node.right as acorn.Identifier).name;
        throw new Error(
          `The script was blocked because it destructured from ${label(rightName)}.\n` +
          `If this is intended, disable ${ruleHint(rightName)} via Settings → Scripting → Blocked roots.`,
        );
      }
      // Destructuring assignment from this: ({ process } = this)
      if (node.left.type === 'ObjectPattern' && node.right.type === 'ThisExpression' && blockedRoots.has('this')) {
        throw new Error(
          `The script was blocked because it destructured from 'this'.\n` +
          `If this is intended, disable it via Settings → Scripting → Blocked roots.`,
        );
      }
    },
    // Static import declaration: import fs from 'fs'
    ImportDeclaration(_node: acorn.ImportDeclaration) {
      throw new Error(
        `The script was blocked because it used a static import declaration.\n` +
        `If this is intended, disable 'eval-intercept' via Settings → Scripting → Enable script sandbox.`,
      );
    },
    // Dynamic import(): import('node:child_process')
    ImportExpression(_node: acorn.Node) {
      throw new Error(
        `The script was blocked because it used a dynamic import().\n` +
        `If this is intended, disable 'eval-intercept' via Settings → Scripting → Enable script sandbox.`,
      );
    },
    // Direct call of a blocked identifier: constructor('return process')()
    // Not caught by MemberExpression since there is no property access involved.
    CallExpression(node: acorn.CallExpression) {
      if (
        node.callee.type === 'Identifier' &&
        blocked.has((node.callee as acorn.Identifier).name)
      ) {
        const calleeName = (node.callee as acorn.Identifier).name;
        throw new Error(
          `The script was blocked because it called ${label(calleeName)}.\n` +
          `If this is intended, disable ${ruleHint(calleeName)} via Settings → Scripting → Blocked roots.`,
        );
      }
    },
  });
}

// Builds and applies the runtime security policy for user-supplied scripts.
//  Extend with `.withRule()` or reduce with `.withoutRule()`.
export class ScriptSecurityPolicy {
  constructor(private readonly rules: ThreatRule[]) {}

  // returns a policy with `rule` appended (immutable). 
  withRule(rule: ThreatRule): ScriptSecurityPolicy {
    return new ScriptSecurityPolicy([...this.rules, rule]);
  }

  // returns a policy with the named rule removed (immutable). 
  withoutRule(name: string): ScriptSecurityPolicy {
    return new ScriptSecurityPolicy(this.rules.filter(r => r.name !== name));
  }

  // returns parallel `names` / `values` arrays for all rules that carry a runtime mask.
  // Pass `violationCheck` to forward the caller's filtered checker (e.g. to eval-intercept).
  buildMaskScope(violationCheck: (script: string) => void = checkSandboxViolations): { names: string[]; values: unknown[] } {
    const names: string[] = [];
    const values: unknown[] = [];
    for (const rule of this.rules) {
      if (rule.maskName !== undefined) {
        names.push(rule.maskName);
        values.push(
          rule.buildMaskValue !== undefined
            ? rule.buildMaskValue(violationCheck)
            : rule.maskValue,
        );
      }
    }
    return { names, values };
  }
}

// Default policy (runtime interceptors and masks).
export const defaultSecurityPolicy = new ScriptSecurityPolicy([
  ...interceptorRules,
  ...maskRules,
]);

// runs all pre-execution security checks and initialises the script environment.
//  1. AST blockes globals, dangerous properties, aliasing, destructuring, dynamic import, and symbol.species.
//  2. mask scope returns the parallel names/values arrays
export async function prepareSandbox(
  script: string,
  context: RequestContext,
  securityPolicy: ScriptSecurityPolicy = defaultSecurityPolicy,
): Promise<SandboxContext> {
  const scriptConsole = getNewConsole();

  let sandboxContext = context;
  let maskNames: string[] = [];
  let maskValues: unknown[] = [];
  // Captured below so the scoped-eval patch (applied after both branches) uses the right checker.
  let evalViolationCheck: (s: string) => void = checkSandboxViolations;

  if (context.settings.scriptSandboxEnabled !== false) {
    const disabledProps = new Set(context.settings.disabledBlockedProperties);
    const disabledRoots = new Set(context.settings.disabledBlockedRoots);
    const activeProperties = new Set([...SANDBOX_BLOCKED_PROPERTIES].filter(p => !disabledProps.has(p)));
    const activeRoots = new Set([...SANDBOX_BLOCKED_ROOTS].filter(r => !disabledRoots.has(r)));
    const blockDynamic = context.settings.scriptBlockUnresolvableProperties !== false;

    // Bind the filtered checker so eval-intercept uses the same active policy.
    const activeSandboxCheck = (s: string) => checkSandboxViolations(s, activeProperties, activeRoots, blockDynamic);
    evalViolationCheck = activeSandboxCheck;

    try {
      activeSandboxCheck(script);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as NodeJS.ErrnoException).code = 'SECURITY_POLICY_VIOLATION';
      throw error;
    }

    // prevents mutate via insomnia._settings.
    sandboxContext = { ...context, settings: deepFreeze({ ...context.settings }) };
    // Always-on interceptors cannot be disabled via settings — filter them out before applying user overrides.
    const disabledRules = (context.settings.disabledSecurityRules ?? []).filter(
      name => !ALWAYS_ON_INTERCEPTORS.has(name),
    );
    const activePolicy = disabledRules.reduce(
      (policy, ruleName) => policy.withoutRule(ruleName),
      securityPolicy,
    );
    ({ names: maskNames, values: maskValues } = activePolicy.buildMaskScope(activeSandboxCheck));
  } else {
    console.warn('[sandbox] script sandbox is disabled — running script without security checks');
    // Even with the sandbox off, always apply the require/window/eval interceptors.
    const alwaysOnPolicy = new ScriptSecurityPolicy(
      interceptorRules.filter(r => ALWAYS_ON_INTERCEPTORS.has(r.name)),
    );
    ({ names: maskNames, values: maskValues } = alwaysOnPolicy.buildMaskScope(checkSandboxViolations));
  }

  // Replace the placeholder eval interceptor with one that carries the full parameter mask.
  // The rule-level interceptor uses (0,eval) (indirect eval in global scope), which bypasses
  // parameter masking and lets scripts access real globals like require, Function, process.
  // Here we patch maskValues to use a new AsyncFunction with the same params and a direct eval,
  // so eval'd code inherits the masked parameter bindings.
  const evalIdx = maskNames.indexOf('eval');
  if (evalIdx !== -1) {
    const strictModeEnabled = context.settings.scriptStrictModeEnabled !== false;
    const evalBody = strictModeEnabled
      ? '"use strict"; return eval(__eval_script__);'
      : 'return eval(__eval_script__);';
    // Exclude 'eval' from the parameter list: naming a parameter 'eval' is illegal in strict mode,
    // and the function needs to call the real eval (not the interceptor) for direct-eval scoping.
    // Use a synchronous Function (not AsyncFunction) to preserve the synchronous return contract —
    // AsyncFunction always returns a Promise, which breaks postMessage structured-clone for sync scripts.
    const nonEvalMaskNames = maskNames.filter(n => n !== 'eval');
    const nonEvalMaskValues = maskValues.filter((_, i) => maskNames[i] !== 'eval');
    const scopedEvalFn = new Function(
      ...nonEvalMaskNames, '__eval_script__',
      evalBody,
    );
    maskValues[evalIdx] = (script: string) => {
      if (!script || typeof script !== 'string') {
        throw new Error('eval is called with invalid or empty value');
      }
      evalViolationCheck(script);
      return scopedEvalFn(...nonEvalMaskValues, script);
    };
  }

  const executionContext = await initInsomniaObject(sandboxContext, scriptConsole.log);

  const bridgeOps: BridgeOps = {
    resetAsyncTasks: Object.freeze(window.bridge.resetAsyncTasks.bind(window.bridge)),
    stopMonitorAsyncTasks: Object.freeze(window.bridge.stopMonitorAsyncTasks.bind(window.bridge)),
    asyncTasksAllSettled: Object.freeze(window.bridge.asyncTasksAllSettled.bind(window.bridge)),
    waitForAllTestsDone: Object.freeze(waitForAllTestsDone),
  };

  return { executionContext, scriptConsole, maskNames, maskValues, bridgeOps };
}
