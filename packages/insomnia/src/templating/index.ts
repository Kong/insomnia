import { type Environment } from 'nunjucks';
import nunjucks from 'nunjucks/browser/nunjucks';

import * as plugins from '../plugins/index';
import { localTemplateTags } from '../ui/components/templating/local-template-tags';
import BaseExtension from './base-extension';
import type { NunjucksParsedTag } from './utils';

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
}

// Some constants
export const RENDER_ALL = 'all';
export const RENDER_VARS = 'variables';
export const RENDER_TAGS = 'tags';
export const NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME = '_';

type NunjucksEnvironment = Environment & {
  extensions: Record<string, BaseExtension>;
};

// Cached globals
let nunjucksVariablesOnly: NunjucksEnvironment | null = null;
let nunjucksTagsOnly: NunjucksEnvironment | null = null;
let nunjucksAll: NunjucksEnvironment | null = null;

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
  const hasNunjucksInterpolationSymbols = text.includes('{{') && text.includes('}}');
  const hasNunjucksCustomTagSymbols = text.includes('{%') && text.includes('%}');
  const hasNunjucksCommentSymbols = text.includes('{#') && text.includes('#}');
  if (!hasNunjucksInterpolationSymbols && !hasNunjucksCustomTagSymbols && !hasNunjucksCommentSymbols) {
    return text;
  }
  const context = config.context || {};
  // context needs to exist on the root for the old templating syntax, and in _ for the new templating syntax
  // old: {{ arr[0].prop }}
  // new: {{ _['arr-name-with-dash'][0].prop }}
  const templatingContext = { ...context, [NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME]: context };
  const path = config.path || null;
  const renderMode = config.renderMode || RENDER_ALL;
  return new Promise<string | null>(async (resolve, reject) => {
    // NOTE: this is added as a breadcrumb because renderString sometimes hangs
    const id = setTimeout(() => console.log('Warning: nunjucks failed to respond within 5 seconds'), 5000);
    const nj = await getNunjucks(renderMode);
    nj?.renderString(text, templatingContext, (err: Error | null, result: any) => {
      clearTimeout(id);
      if (err) {
        console.log('Error rendering template', err);
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

  return Object.keys(env.extensions)
    .map(k => env.extensions[k])
    .filter(ext => !ext.isDeprecated())
    .sort((a, b) => (a.getPriority() > b.getPriority() ? 1 : -1))
    .map<NunjucksParsedTag>(ext => ({
      name: ext.getTag() || '',
      displayName: ext.getName() || '',
      liveDisplayName: ext.getLiveDisplayName(),
      description: ext.getDescription(),
      disablePreview: ext.getDisablePreview(),
      args: ext.getArgs(),
      actions: ext.getActions(),
    }));
}

async function getNunjucks(renderMode: string): Promise<NunjucksEnvironment> {
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
  const nunjucksEnvironment = nunjucks.configure(config) as NunjucksEnvironment;

  const pluginTemplateTags = await plugins.getTemplateTags();

  const allExtensions = [...pluginTemplateTags, ...localTemplateTags];

  for (const extension of allExtensions) {
    const { templateTag, plugin } = extension;
    templateTag.priority = templateTag.priority || allExtensions.indexOf(extension);
    // @ts-expect-error -- TSCONVERSION
    const instance = new BaseExtension(templateTag, plugin);
    nunjucksEnvironment.addExtension(instance.getTag() || '', instance);
    // Hidden helper filter to debug complicated things
    // eg. `{{ foo | urlencode | debug | upper }}`
    nunjucksEnvironment.addFilter('debug', (o: any) => o);
  }

  // ~~~~~~~~~~~~~~~~~~~~ //
  // Cache Env and Return //
  // ~~~~~~~~~~~~~~~~~~~~ //
  if (renderMode === RENDER_VARS) {
    nunjucksVariablesOnly = nunjucksEnvironment;
  } else if (renderMode === RENDER_TAGS) {
    nunjucksTagsOnly = nunjucksEnvironment;
  } else {
    nunjucksAll = nunjucksEnvironment;
  }

  return nunjucksEnvironment;
}
