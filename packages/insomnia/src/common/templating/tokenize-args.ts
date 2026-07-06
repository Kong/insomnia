import type { NunjucksParsedTagArg } from './types';

export function tokenizeArgs(argsStr: string): NunjucksParsedTagArg[] {
  const args: NunjucksParsedTagArg[] = [];
  let quotedBy: "'" | '"' | null = null;
  let currentArg: string | null = null;

  for (let i = 0; i < argsStr.length + 1; i++) {
    // Adding an "invisible" at the end helps us terminate the last arg
    const c = argsStr.charAt(i) || ',';

    // Do nothing if we're still on a space or comma
    if (currentArg === null && c.match(/[\s,]/)) {
      continue;
    }

    // Start a new single-quoted string
    if (currentArg === null && c === "'") {
      currentArg = '';
      quotedBy = "'";
      continue;
    }

    // Start a new double-quoted string
    if (currentArg === null && c === '"') {
      currentArg = '';
      quotedBy = '"';
      continue;
    }

    // Start a new unquoted string
    if (currentArg === null) {
      currentArg = c;
      quotedBy = null;
      continue;
    }

    const endQuoted = quotedBy && c === quotedBy;
    const endUnquoted = !quotedBy && c === ',';
    const argCompleted = endQuoted || endUnquoted;

    // Append current char to argument
    if (!argCompleted && currentArg !== null) {
      if (c === '\\') {
        // Handle backslashes
        i += 1;
        currentArg += argsStr.charAt(i);
      } else {
        currentArg += c;
      }
    }

    // End current argument
    if (currentArg !== null && argCompleted) {
      let arg: NunjucksParsedTagArg;

      if (quotedBy) {
        arg = {
          type: 'string',
          value: currentArg,
          quotedBy,
        };
      } else if (['true', 'false'].includes(currentArg)) {
        arg = {
          type: 'boolean',
          value: currentArg.toLowerCase() === 'true',
        };
      } else if (currentArg.match(/^\d*\.?\d*$/)) {
        arg = {
          type: 'number',
          value: currentArg,
        };
      } else if (currentArg.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/)) {
        arg = {
          type: 'variable',
          value: currentArg,
        };
      } else {
        arg = {
          type: 'expression',
          value: currentArg,
        };
      }

      args.push(arg);
      currentArg = null;
      quotedBy = null;
    }
  }

  return args;
}
