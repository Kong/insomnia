import { get as _get } from 'es-toolkit/compat';
import { UndefinedVariableError } from 'liquidjs';

export class RenderError extends Error {
  // TODO: unsound definite assignment assertions
  // This is easy to fix, but be careful: extending from Error has especially tricky behavior.
  message!: string;
  path!: string | null;
  location!: {
    line: number;
    column: number;
  };

  type!: string;
  reason!: string;
  extraInfo?: { subType: 'environmentVariable'; undefinedEnvironmentVariables: string[] };

  constructor(message: string) {
    super(message);
    this.message = message;
  }
}

/**
 * Translate a LiquidJS error into our RenderError shape.
 * LiquidJS errors expose line/col directly on token.getPosition().
 */
export function translateLiquidError(
  err: Error,
  _text: string,
  _templatingContext: Record<string, any>,
  path: string | null,
): RenderError {
  const isUndefined = err instanceof UndefinedVariableError;
  const token = (err as any).token;
  let line = 1;
  let column = 1;
  if (token && typeof token.getPosition === 'function') {
    const pos = token.getPosition() as number[];
    line = pos[0] ?? 1;
    column = pos[1] ?? 1;
  }
  const sanitizedMsg = err.message
    .replace(/,?\s*line:\d+,?\s*col:\d+/g, '')
    .replace(/^\s*Error:\s*/, '')
    .trim();
  const newError = new RenderError(sanitizedMsg);
  newError.path = path || '';
  newError.message = sanitizedMsg;
  newError.location = { line, column };
  newError.type = 'render';
  newError.reason = isUndefined ? 'undefined' : 'error';
  return newError;
}

// Collect all variable names that are defined WITHIN the template itself via
// assign/capture/for/increment/decrement (including inside {% liquid %} blocks).
// These are template-scoped, not environment variables, and must not appear in
// the "missing environment variables" list.
function extractTemplateDefinedVars(text: string): Set<string> {
  const defined = new Set<string>();
  let m: RegExpExecArray | null;

  const assignRe = /{%-?\s*assign\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
  while ((m = assignRe.exec(text)) !== null) { defined.add(m[1]); }

  const captureRe = /{%-?\s*capture\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*-?%}/g;
  while ((m = captureRe.exec(text)) !== null) { defined.add(m[1]); }

  // {% for varName in … %} also makes the `forloop` object available
  const forRe = /{%-?\s*for\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+in/g;
  while ((m = forRe.exec(text)) !== null) { defined.add(m[1]); defined.add('forloop'); }

  // {% tablerow varName in … %} also makes `tablerowloop` available
  const tablerowRe = /{%-?\s*tablerow\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+in/g;
  while ((m = tablerowRe.exec(text)) !== null) { defined.add(m[1]); defined.add('tablerowloop'); }

  const incrRe = /{%-?\s*(?:increment|decrement)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*-?%}/g;
  while ((m = incrRe.exec(text)) !== null) { defined.add(m[1]); }

  // {% liquid %} blocks use newline-separated statements without per-line delimiters
  const liquidBlockRe = /{%-?\s*liquid\s+([\s\S]*?)-?%}/g;
  while ((m = liquidBlockRe.exec(text)) !== null) {
    const block = m[1];
    let n: RegExpExecArray | null;
    const lAssign = /^\s*assign\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/mg;
    while ((n = lAssign.exec(block)) !== null) { defined.add(n[1]); }
    const lCapture = /^\s*capture\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/mg;
    while ((n = lCapture.exec(block)) !== null) { defined.add(n[1]); }
    const lFor = /^\s*for\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+in/mg;
    while ((n = lFor.exec(block)) !== null) { defined.add(n[1]); defined.add('forloop'); }
    const lIncr = /^\s*(?:increment|decrement)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/mg;
    while ((n = lIncr.exec(block)) !== null) { defined.add(n[1]); }
  }

  return defined;
}

// LiquidJS only reports the first undefined variable, so we regex-scan the
// full template text to find all missing variables for the UI panel.
export function extractUndefinedVariableKey(text = '', templatingContext: Record<string, any>): string[] {
  // Strip Liquid filter expressions (| filter: args) so `{{ a | upper }}` reports `a` not `a | upper`
  const regexVariable = /{{\s*([^|}\s][^|}]*?)\s*(?:\|[^}]*)?\s*}}/g;
  const templateDefined = extractTemplateDefinedVars(text);
  const missingVariables: string[] = [];
  const seen = new Set<string>();
  let match;

  while ((match = regexVariable.exec(text)) !== null) {
    let variable = match[1].trim();
    if (variable.includes('_.')) {
      variable = variable.split('_.')[1];
    }
    // Skip duplicates and variables whose root is defined within the template
    // (e.g. `forloop.index` is covered by `forloop` being in templateDefined).
    const baseVar = variable.split('.')[0];
    if (seen.has(variable) || templateDefined.has(variable) || templateDefined.has(baseVar)) {
      continue;
    }
    seen.add(variable);
    if (_get(templatingContext, variable) === undefined) {
      missingVariables.push(variable);
    }
  }
  return missingVariables;
}
