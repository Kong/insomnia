import nunjucks from 'nunjucks';
import * as extensions from './extensions';

/**
 * Render text based on stuff
 * @param {String} text - Nunjucks template in text form
 * @param {Object} [config] - Config options for rendering
 * @param {Object} [config.context] - Context to render with
 */
export async function render (text, config = {}) {
  const context = config.context || {};

  return new Promise((resolve, reject) => {
    _getEnv().renderString(text, context, (err, result) => {
      if (err) {
        const sanitizedMsg = err.message.replace(/\(unknown path\)\s*/, '');
        reject(new Error(sanitizedMsg));
      } else {
        resolve(result);
      }
    });
  });
}

// ~~~~~~~~~~~~~ //
// Private Stuff //
// ~~~~~~~~~~~~~ //

let _nunjucksEnvironment = null;
function _getEnv () {
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
