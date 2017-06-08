/**
 * Get list of paths to all primitive types in nested object
 * @param {object} obj - object to analyse
 * @param {String} [prefix] - base path to prefix to all paths
 * @returns {Array} - list of paths
 */
export function getKeys (obj, prefix = '') {
  let allKeys = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      allKeys = [...allKeys, ...getKeys(obj[i], `${prefix}[${i}]`)];
    }
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      allKeys = [...allKeys, ...getKeys(obj[key], newPrefix)];
    }
  } else if (typeof obj === 'function') {
    // Skip functions
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
export function tokenizeTag (tagStr) {
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
        arg = {type: 'boolean', value: currentArg};
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

/**
 * Convert a tokenized tag back into a Nunjucks string
 * @param {object} tagData - tag data to serialize
 * @return {string} tag as a Nunjucks string
 */
export function unTokenizeTag (tagData) {
  const args = [];
  for (const arg of tagData.args) {
    if (arg.type === 'string') {
      const q = arg.quotedBy || "'";
      const re = new RegExp(`([^\\\\])${q}`, 'g');
      const str = arg.value.replace(re, `$1\\${q}`);
      args.push(`${q}${str}${q}`);
    } else {
      args.push(arg.value);
    }
  }

  const argsStr = args.join(', ');
  return `{% ${tagData.name} ${argsStr} %}`;
}

/**
 * Get the default Nunjucks string for an extension
 * @param {string} name
 * @param {object[]} args
 * @returns {string}
 */
export function getDefaultFill (name, args) {
  const stringArgs = (args || []).map(argDefinition => {
    if (argDefinition.type === 'enum') {
      const {defaultValue, options} = argDefinition;
      const value = defaultValue !== undefined ? defaultValue : options[0].value;
      return `'${value}'`;
    } else if (argDefinition.type === 'number') {
      const {defaultValue} = argDefinition;
      return defaultValue !== undefined ? defaultValue : 0;
    } else {
      const {defaultValue} = argDefinition;
      return defaultValue !== undefined ? `'${defaultValue}'` : "''";
    }
  });

  return `${name} ${stringArgs.join(', ')}`;
}
