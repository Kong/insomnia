import { get as _get } from 'es-toolkit/compat';
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

// because nunjucks only report the first error, we need to extract all missing variables that are not present in the context
// for example, if the text is `{{ a }} {{ b }}`, nunjucks only report `a` is missing, but we need to report both `a` and `b`
export function extractUndefinedVariableKey(text = '', templatingContext: Record<string, any>): string[] {
  const regexVariable = /{{\s*([^ }]+)\s*}}/g;
  const missingVariables: string[] = [];
  let match;

  while ((match = regexVariable.exec(text)) !== null) {
    let variable = match[1];
    if (variable.includes('_.')) {
      variable = variable.split('_.')[1];
    }
    // Check if the variable is not present in the context
    if (_get(templatingContext, variable) === undefined) {
      missingVariables.push(variable);
    }
  }
  return missingVariables;
}
