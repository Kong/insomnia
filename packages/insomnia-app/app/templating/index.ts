import nunjucks from 'nunjucks';

import type { TemplateTag } from '../plugins/index';
import * as plugins from '../plugins/index';
import BaseExtension from './base-extension';
import type { NunjucksParsedTag } from './utils';

export class RenderError extends Error {
  message: string;
  path: string | null;
  location: {
    line: number;
    column: number;
  };

  type: string;
  reason: string;
}

// Some constants
export const RENDER_ALL = 'all';
export const RENDER_VARS = 'variables';
export const RENDER_TAGS = 'tags';
export const NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME = '_';

// Cached globals
let nunjucksVariablesOnly: nunjucks.Environment | null = null;
let nunjucksTagsOnly: nunjucks.Environment | null = null;
let nunjucksAll: nunjucks.Environment | null = null;

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
  config: {
    context?: Record<string, any>;
    path?: string;
    renderMode?: string;
  } = {},
) {
  const context = config.context || {};
  // context needs to exist on the root for the old templating syntax, and in _ for the new templating syntax
  // old: {{ arr[0].prop }}
  // new: {{ _['arr-name-with-dash'][0].prop }}
  const templatingContext = { ...context, [NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME]: context };
  const path = config.path || null;
  const renderMode = config.renderMode || RENDER_ALL;
  return new Promise<string | null>(async (resolve, reject) => {
    const nj = await getNunjucks(renderMode);
    nj?.renderString(text, templatingContext, (err, result) => {
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
        const newError = new RenderError(sanitizedMsg);
        newError.path = path || '';
        newError.message = sanitizedMsg;
        newError.location = {
          line,
          column,
        };
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
export function reload() {
  nunjucksAll = null;
  nunjucksVariablesOnly = null;
  nunjucksTagsOnly = null;
}

/**
 * Get definitions of template tags
 */
export async function getTagDefinitions() {
  const env = await getNunjucks(RENDER_ALL);
  // @ts-expect-error -- TSCONVERSION investigate why `extensions` isn't on Environment
  return Object.keys(env.extensions)
    // @ts-expect-error -- TSCONVERSION investigate why `extensions` isn't on Environment
    .map(k => env.extensions[k])
    .filter(ext => !ext.isDeprecated())
    .sort((a, b) => (a.getPriority() > b.getPriority() ? 1 : -1))
    .map<NunjucksParsedTag>(ext => ({
      name: ext.getTag(),
      displayName: ext.getName(),
      liveDisplayName: ext.getLiveDisplayName(),
      description: ext.getDescription(),
      disablePreview: ext.getDisablePreview(),
      args: ext.getArgs(),
      actions: ext.getActions(),
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
    autoescape: false,
    // Don't escape HTML
    throwOnUndefined: true,
    // Strict mode
    tags: {
      blockStart: '{%',
      blockEnd: '%}',
      variableStart: '{{',
      variableEnd: '}}',
      commentStart: '{#',
      commentEnd: '#}',
    },
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
  let allTemplateTagPlugins: TemplateTag[];

  try {
    plugins.ignorePlugin('insomnia-plugin-kong-declarative-config');
    plugins.ignorePlugin('insomnia-plugin-kong-kubernetes-config');
    plugins.ignorePlugin('insomnia-plugin-kong-portal');
    allTemplateTagPlugins = await plugins.getTemplateTags();
  } finally {
    plugins.clearIgnores();
  }

  const allExtensions = allTemplateTagPlugins;

  for (let i = 0; i < allExtensions.length; i++) {
    const { templateTag, plugin } = allExtensions[i];
    templateTag.priority = templateTag.priority || i * 100;
    // @ts-expect-error -- TSCONVERSION
    const instance = new BaseExtension(templateTag, plugin);
    // @ts-expect-error -- TSCONVERSION
    nj.addExtension(instance.getTag(), instance);
    // Hidden helper filter to debug complicated things
    // eg. `{{ foo | urlencode | debug | upper }}`
    nj.addFilter('debug', o => o);
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
