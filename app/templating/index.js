import nunjucks from 'nunjucks';
import * as extensions from './extensions';

/**
 * Render text based on stuff
 * @param {String} text - Nunjucks template in text form
 * @param {Object} [config] - Config options for rendering
 * @param {Object} [config.context] - Context to render with
 * @param {Object} [config.strict] - Fail on undefined values
 */
export async function render (text, config = {}) {
  const context = config.context || {};
  const strict = config.strict;

  return new Promise((resolve, reject) => {
    const env = getNunjucksEnvironment(strict);
    env.renderString(text, context, (err, result) => {
      if (err) {
        const sanitizedMsg = err.message
          .replace(/\(unknown path\)\s*/, '')
          .replace(/^Error: */, '')
          .replace('attempted to output null or undefined value', 'undefined variable');

        reject(new Error(sanitizedMsg));
      } else {
        resolve(result);
      }
    });
  });
}

function getNunjucksEnvironment (strict = false) {
  return strict ? _getStrictEnv() : _getNormalEnv();
}

// ~~~~~~~~~~~~~ //
// Private Stuff //
// ~~~~~~~~~~~~~ //

let _nunjucksEnvironment = null;
function _getNormalEnv () {
  if (!_nunjucksEnvironment) {
    _nunjucksEnvironment = nunjucks.configure({
      autoescape: false,
    });

    for (const Cls of extensions.all()) {
      _nunjucksEnvironment.addExtension(Cls.name, new Cls());
    }
  }

  return _nunjucksEnvironment;
}

let _nunjucksStrictEnvironment = null;
function _getStrictEnv () {
  if (!_nunjucksStrictEnvironment) {
    _nunjucksStrictEnvironment = nunjucks.configure({
      autoescape: false,
      throwOnUndefined: true,
    });

    for (const Cls of extensions.all()) {
      _nunjucksStrictEnvironment.addExtension(Cls.name, new Cls());
    }
  }

  return _nunjucksStrictEnvironment;
}
