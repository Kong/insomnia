// @flow
import nunjucks from 'nunjucks';
import BaseExtension from './base-extension';
import type { NunjucksParsedTag } from './utils';
import * as plugins from '../plugins/index';

export class RenderError extends Error {
  message: string;
  path: string | null;
  location: { line: number, column: number };
  type: string;
  reason: string;
}

// Some constants
export const RENDER_ALL = 'all';
export const RENDER_VARS = 'variables';
export const RENDER_TAGS = 'tags';

// Cached globals
let nunjucksVariablesOnly = null;
let nunjucksTagsOnly = null;
let nunjucksAll = null;

/**
 * Render text based on stuff
 * @param {String} text - Nunjucks template in text form
 * @param {Object} [config] - Config options for rendering
 * @param {Object} [config.context] - Context to render with
 * @param {Object} [config.path] - Path to include in the error message
 * @param {Object} [config.renderMode] - Only render variables (not tags)
 */
export function render(
  text: string,
  config: { context?: Object, path?: string, renderMode?: string } = {}
): Promise<string> {
  const context = config.context || {};
  const path = config.path || null;
  const renderMode = config.renderMode || RENDER_ALL;

  return new Promise(async (resolve, reject) => {
    const nj = await getNunjucks(renderMode);

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
        const reason = err.message.includes(
          'attempted to output null or undefined value'
        )
          ? 'undefined'
          : 'error';

        const newError = new RenderError(sanitizedMsg);
        newError.path = path || '';
        newError.message = sanitizedMsg;
        newError.location = { line, column };
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
export function reload(): void {
  nunjucksAll = null;
  nunjucksVariablesOnly = null;
  nunjucksTagsOnly = null;
}

/**
 * Get definitions of template tags
 */
export async function getTagDefinitions(): Promise<Array<NunjucksParsedTag>> {
  const env = await getNunjucks(RENDER_ALL);

  return Object.keys(env.extensions)
    .map(k => env.extensions[k])
    .filter(ext => !ext.isDeprecated())
    .sort((a, b) => (a.getPriority() > b.getPriority() ? 1 : -1))
    .map(ext => ({
      name: ext.getTag(),
      displayName: ext.getName(),
      description: ext.getDescription(),
      args: ext.getArgs()
    }));
}

async function getNunjucks(renderMode: string) {
  if (renderMode === RENDER_VARS && nunjucksVariablesOnly) {
    return nunjucksVariablesOnly;
  }

  if (renderMode === RENDER_TAGS && nunjucksTagsOnly) {
    return nunjucksTagsOnly;
  }

  if (renderMode === RENDER_ALL && nunjucksAll) {
    return nunjucksAll;
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

  if (renderMode === RENDER_VARS) {
    // Set tag syntax to something that will never happen naturally
    config.tags.blockStart = '<[{[{[{[{[$%';
    config.tags.blockEnd = '%$]}]}]}]}]>';
  }

  if (renderMode === RENDER_TAGS) {
    // Set tag syntax to something that will never happen naturally
    config.tags.variableStart = '<[{[{[{[{[$%';
    config.tags.variableEnd = '%$]}]}]}]}]>';
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Create Env with Extensions //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //

  const nj = nunjucks.configure(config);

  const allTemplateTagPlugins = await plugins.getTemplateTags();
  const allExtensions = allTemplateTagPlugins;
  for (let i = 0; i < allExtensions.length; i++) {
    const { templateTag, plugin } = allExtensions[i];
    templateTag.priority = templateTag.priority || i * 100;
    const instance = new BaseExtension(templateTag, plugin);
    nj.addExtension(instance.getTag(), instance);

    // Hidden helper filter to debug complicated things
    // eg. `{{ foo | urlencode | debug | upper }}`
    nj.addFilter('debug', o => {
      return o;
    });
  }

  // ~~~~~~~~~~~~~~~~~~~~ //
  // Cache Env and Return //
  // ~~~~~~~~~~~~~~~~~~~~ //

  if (renderMode === RENDER_VARS) {
    nunjucksVariablesOnly = nj;
  } else if (renderMode === RENDER_TAGS) {
    nunjucksTagsOnly = nj;
  } else {
    nunjucksAll = nj;
  }

  return nj;
}
