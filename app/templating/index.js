import nunjucks from 'nunjucks';
import * as extensions from './extensions';
import BaseExtension from './base-extension';

// Cached globals
let nunjucksVariablesOnly = null;
let nunjucksDefault = null;

/**
 * Render text based on stuff
 * @param {String} text - Nunjucks template in text form
 * @param {Object} [config] - Config options for rendering
 * @param {Object} [config.context] - Context to render with
 * @param {Object} [config.path] - Path to include in the error message
 * @param {Object} [config.variablesOnly] - Only render variables (not tags)
 */
export function render (text, config = {}) {
  const context = config.context || {};
  const path = config.path || null;
  const variablesOnly = config.variablesOnly || false;

  return new Promise((resolve, reject) => {
    const nj = getNunjucks(variablesOnly);

    nj.renderString(text, context, (err, result) => {
      if (err) {
        const sanitizedMsg = err.message
          .replace(/\(unknown path\)\s/, '')
          .replace(/\[Line \d+, Column \d*]/, '')
          .replace(/^\s*Error:\s*/, '')
          .trim();

        const location = err.message.match(/\[Line (\d)+, Column (\d)*]/);
        const line = location ? parseInt(location[1]) : 1;
        const column = location ? parseInt(location[2]) : 1;
        const reason = err.message.includes('attempted to output null or undefined value')
          ? 'undefined'
          : 'error';

        const newError = new Error(sanitizedMsg);
        newError.path = path || null;
        newError.message = sanitizedMsg;
        newError.location = {line, column};
        newError.type = 'render';
        newError.reason = reason;
        reject(newError);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Reload Nunjucks environments. Useful for if plugins change.
 */
export function reloadNunjucks () {
  nunjucksDefault = null;
  nunjucksVariablesOnly = null;

  // TODO: Make this less horrible
  getNunjucks(true);
  getNunjucks(false);
}

/**
 * Get definitions of template tags
 */
export function getTagDefinitions () {
  const env = getNunjucks();

  return Object.keys(env.extensions)
    .map(k => env.extensions[k])
    .filter(ext => !ext.isDeprecated())
    .sort((a, b) => a.getPriority() > b.getPriority() ? 1 : -1)
    .map(ext => ({
      name: ext.getTag(),
      displayName: ext.getName(),
      description: ext.getDescription(),
      args: ext.getArgs()
    }));
}

function getNunjucks (variablesOnly) {
  if (variablesOnly && nunjucksVariablesOnly) {
    return nunjucksVariablesOnly;
  }

  if (!variablesOnly && nunjucksDefault) {
    return nunjucksDefault;
  }

  // ~~~~~~~~~~~~ //
  // Setup Config //
  // ~~~~~~~~~~~~ //

  const config = {
    autoescape: false, // Don't escape HTML
    throwOnUndefined: true, // Strict mode
    tags: {
      blockStart: '{%',
      blockEnd: '%}',
      variableStart: '{{',
      variableEnd: '}}',
      commentStart: '{#',
      commentEnd: '#}'
    }
  };

  if (variablesOnly) {
    // Set tag syntax to something that will never happen naturally
    config.tags.blockStart = '<[{[{[{[{[$%';
    config.tags.blockEnd = '%$]}]}]}]}]>';
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Create Env with Extensions //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const nj = nunjucks.configure(config);

  const allExtensions = extensions.all();
  for (let i = 0; i < allExtensions.length; i++) {
    const ext = allExtensions[i];
    ext.priority = ext.priority || i * 100;
    const instance = new BaseExtension(ext);
    nj.addExtension(instance.getTag(), instance);
  }

  // ~~~~~~~~~~~~~~~~~~~~ //
  // Cache Env and Return //
  // ~~~~~~~~~~~~~~~~~~~~ //

  if (variablesOnly) {
    nunjucksVariablesOnly = nj;
  } else {
    nunjucksDefault = nj;
  }

  return nj;
}
