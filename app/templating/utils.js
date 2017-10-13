// @flow

export type NunjucksParsedTagArg = {
  type: 'string' | 'number' | 'boolean' | 'number' | 'variable' | 'expression',
  value: string | number | boolean,
  defaultValue?: string | number | boolean,
  forceVariable?: boolean,
  quotedBy?: '"' | "'"
};

export type NunjucksParsedTag = {
  name: string,
  args: Array<NunjucksParsedTagArg>,
  rawValue?: string
};

/**
 * Get list of paths to all primitive types in nested object
 * @param {object} obj - object to analyse
 * @param {String} [prefix] - base path to prefix to all paths
 * @returns {Array} - list of paths
 */
export function getKeys (obj: any, prefix: string = ''): Array<{name: string, value: any}> {
  let allKeys = [];

  const typeOfObj = Object.prototype.toString.call(obj);

  if (typeOfObj === '[object Array]') {
    for (let i = 0; i < obj.length; i++) {
      allKeys = [...allKeys, ...getKeys(obj[i], `${prefix}[${i}]`)];
    }
  } else if (typeOfObj === '[object Object]') {
    const keys = Object.keys(obj);
    for (const key of keys) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      allKeys = [...allKeys, ...getKeys(obj[key], newPrefix)];
    }
  } else if (typeOfObj === '[object Function]') {
    // Ignore functions
  } else if (prefix) {
    allKeys.push({name: prefix, value: obj});
  }

  return allKeys;
}

/**
 * Parse a Nunjucks tag string into a usable abject
 * @param {string} tagStr - the template string for the tag
 * @return {object} parsed tag data
 */
export function tokenizeTag (tagStr: string): NunjucksParsedTag {
  // ~~~~~~~~ //
  // Sanitize //
  // ~~~~~~~~ //

  const withoutEnds = tagStr
    .trim()
    .replace(/^{%/, '')
    .replace(/%}$/, '')
    .trim();

  const nameMatch = withoutEnds.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*/);
  const name = nameMatch ? nameMatch[0] : withoutEnds;
  const argsStr = withoutEnds.slice(name.length);

  // ~~~~~~~~~~~~~ //
  // Tokenize Args //
  // ~~~~~~~~~~~~~ //

  const args = [];
  let quotedBy = null;
  let currentArg = null;
  for (let i = 0; i < argsStr.length + 1; i++) {
    // Adding an "invisible" at the end helps us terminate the last arg
    const c = argsStr.charAt(i) || ',';

    // Do nothing if we're still on a space o comma
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
        arg = {type: 'string', value: currentArg, quotedBy};
      } else if (['true', 'false'].includes(currentArg)) {
        arg = {type: 'boolean', value: currentArg.toLowerCase() === 'true'};
      } else if (currentArg.match(/^\d*\.?\d*$/)) {
        arg = {type: 'number', value: currentArg};
      } else if (currentArg.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/)) {
        arg = {type: 'variable', value: currentArg};
      } else {
        arg = {type: 'expression', value: currentArg};
      }

      args.push(arg);

      currentArg = null;
      quotedBy = null;
    }
  }

  return {name, args};
}

/** Convert a tokenized tag back into a Nunjucks string */
export function unTokenizeTag (tagData: NunjucksParsedTag): string {
  const args = [];
  for (const arg of tagData.args) {
    if (arg.type === 'string') {
      const q = arg.quotedBy || "'";
      const re = new RegExp(`([^\\\\])${q}`, 'g');
      const str = arg.value.toString().replace(re, `$1\\${q}`);
      args.push(`${q}${str}${q}`);
    } else if (arg.type === 'boolean') {
      args.push(arg.value ? 'true' : 'false');
    } else {
      args.push(arg.value);
    }
  }

  const argsStr = args.join(', ');
  return `{% ${tagData.name} ${argsStr} %}`;
}

/** Get the default Nunjucks string for an extension */
export function getDefaultFill (name: string, args: Array<NunjucksParsedTagArg>): string {
  const stringArgs: Array<string> = (args || []).map(argDefinition => {
    switch (argDefinition.type) {
      case 'enum':
        const {defaultValue, options} = argDefinition;
        const value = defaultValue !== undefined ? defaultValue : options[0].value;
        return `'${value}'`;
      case 'number':
        return `${parseFloat(argDefinition.defaultValue) || 0}`;
      case 'boolean':
        return argDefinition.defaultValue ? 'true' : 'false';
      case 'string':
        return `'${(argDefinition.defaultValue: any) || ''}'`;
      default:
        return "''";
    }
  });

  return `${name} ${stringArgs.join(', ')}`;
}
