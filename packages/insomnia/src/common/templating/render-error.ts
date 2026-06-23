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

// LiquidJS only reports the first undefined variable, so we regex-scan the
// full template text to find all missing variables for the UI panel.
export function extractUndefinedVariableKey(text = '', templatingContext: Record<string, any>): string[] {
  // Strip Liquid filter expressions (| filter: args) so `{{ a | upper }}` reports `a` not `a | upper`
  const regexVariable = /{{\s*([^|}\s][^|}]*?)\s*(?:\|[^}]*)?\s*}}/g;
  const missingVariables: string[] = [];
  let match;

  while ((match = regexVariable.exec(text)) !== null) {
    let variable = match[1].trim();
    if (variable.includes('_.')) {
      variable = variable.split('_.')[1];
    }
    if (_get(templatingContext, variable) === undefined) {
      missingVariables.push(variable);
    }
  }
  return missingVariables;
}
