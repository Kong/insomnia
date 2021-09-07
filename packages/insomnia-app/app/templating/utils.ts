import objectPath from 'objectpath';

import type { PluginStore } from '../plugins/context';
import type { PluginArgumentEnumOption } from './extensions';

export interface NunjucksParsedTagArg {
  type: 'string' | 'number' | 'boolean' | 'variable' | 'expression' | 'enum' | 'file' | 'model';
  encoding?: 'base64';
  value: string | number | boolean;
  defaultValue?: string | number | boolean;
  forceVariable?: boolean;
  placeholder?: string;
  help?: string;
  displayName?: string;
  quotedBy?: '"' | "'";
  validate?: (value: any) => string;
  hide?: (arg0: NunjucksParsedTagArg[]) => boolean;
  model?: string;
  options?: PluginArgumentEnumOption[];
  itemTypes?: ('file' | 'directory')[];
  extensions?: string[];
}

export interface NunjucksActionTag {
  name: string;
  icon?: string;
  run: (context: PluginStore) => Promise<void>;
}

export interface NunjucksParsedTag {
  name: string;
  args: NunjucksParsedTagArg[];
  actions?: NunjucksActionTag[];
  rawValue?: string;
  displayName?: string;
  description?: string;
  disablePreview?: (arg0: NunjucksParsedTagArg[]) => boolean;
}

interface Key {
  name: string;
  value: any;
}

/**
 * Get list of paths to all primitive types in nested object
 * @param {object} obj - object to analyse
 * @param {String} [prefix] - base path to prefix to all paths
 * @returns {Array} - list of paths
 */
export function getKeys(
  obj: any,
  prefix = '',
): Key[] {
  let allKeys: Key[] = [];
  const typeOfObj = Object.prototype.toString.call(obj);

  if (typeOfObj === '[object Array]') {
    for (let i = 0; i < obj.length; i++) {
      allKeys = [...allKeys, ...getKeys(obj[i], forceBracketNotation(prefix, i))];
    }
  } else if (typeOfObj === '[object Object]') {
    const keys = Object.keys(obj);

    for (const key of keys) {
      allKeys = [...allKeys, ...getKeys(obj[key], forceBracketNotation(prefix, key))];
    }
  } else if (typeOfObj === '[object Function]') {
    // Ignore functions
  } else if (prefix) {
    allKeys.push({
      name: normalizeToDotAndBracketNotation(prefix),
      value: obj,
    });
  }

  return allKeys;
}

export function forceBracketNotation(prefix: string, key: string | number) {
  // Prefix is already in bracket notation because getKeys is recursive
  return `${prefix}${objectPath.stringify([key], "'", true)}`;
}

export function normalizeToDotAndBracketNotation(prefix: string) {
  return objectPath.normalize(prefix);
}

/**
 * Parse a Nunjucks tag string into a usable abject
 * @param {string} tagStr - the template string for the tag
 */
export function tokenizeTag(tagStr: string) {
  // ~~~~~~~~ //
  // Sanitize //
  // ~~~~~~~~ //
  const withoutEnds = tagStr.trim().replace(/^{%/, '').replace(/%}$/, '').trim();
  const nameMatch = withoutEnds.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*/);
  const name = nameMatch ? nameMatch[0] : withoutEnds;
  const argsStr = withoutEnds.slice(name.length);
  // ~~~~~~~~~~~~~ //
  // Tokenize Args //
  // ~~~~~~~~~~~~~ //
  const args: NunjucksParsedTagArg[] = [];
  let quotedBy: string | null = null;
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
      let arg;

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

  const parsedTag: NunjucksParsedTag = {
    name,
    args,
  };
  return parsedTag;
}

/** Convert a tokenized tag back into a Nunjucks string */
export function unTokenizeTag(tagData: NunjucksParsedTag) {
  const args: string[] = [];

  for (const arg of tagData.args) {
    if (['string', 'model', 'file', 'enum'].includes(arg.type)) {
      const q = arg.quotedBy || "'";
      const re = new RegExp(`([^\\\\])${q}`, 'g');
      const str = arg.value.toString().replace(re, `$1\\${q}`);
      args.push(`${q}${str}${q}`);
    } else if (arg.type === 'boolean') {
      args.push(arg.value ? 'true' : 'false');
    } else {
      // @ts-expect-error -- TSCONVERSION
      args.push(arg.value);
    }
  }

  const argsStr = args.join(', ');
  return `{% ${tagData.name} ${argsStr} %}`;
}

/** Get the default Nunjucks string for an extension */
export function getDefaultFill(name: string, args: NunjucksParsedTagArg[]) {
  const stringArgs: string[] = (args || []).map(argDefinition => {
    switch (argDefinition.type) {
      case 'enum':
        const { defaultValue, options } = argDefinition;
        const fallback = options && options.length ? options[0].value : '';
        const value = defaultValue !== undefined ? String(defaultValue) : String(fallback);
        return `'${value}'`;

      case 'number':
        // @ts-expect-error -- TSCONVERSION
        return `${parseFloat(argDefinition.defaultValue) || 0}`;

      case 'boolean':
        return argDefinition.defaultValue ? 'true' : 'false';

      case 'string':
      case 'file':
      case 'model':
        return `'${(argDefinition.defaultValue as any) || ''}'`;

      default:
        return "''";
    }
  });
  return `${name} ${stringArgs.join(', ')}`;
}

export function encodeEncoding(value: string, encoding: 'base64') {
  if (typeof value !== 'string') {
    return value;
  }

  if (encoding === 'base64') {
    const encodedValue = Buffer.from(value, 'utf8').toString('base64');
    return `b64::${encodedValue}::46b`;
  }

  return value;
}

export function decodeEncoding(value: string) {
  if (typeof value !== 'string') {
    return value;
  }

  const results = value.match(/^b64::(.+)::46b$/);

  if (results) {
    return Buffer.from(results[1], 'base64').toString('utf8');
  }

  return value;
}
