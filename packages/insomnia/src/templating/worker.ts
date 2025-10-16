import type { Environment } from 'nunjucks';

import { localTemplateTags } from '~/templating/local-template-tags';
import { nunjucks } from '~/templating/nunjucks.client';

import type { TemplateTag } from '../plugins';
import BaseExtensionWorker, { fetchFromTemplateWorkerDatabase } from './base-extension-worker';
import { extractUndefinedVariableKey, RenderError } from './render-error';

// Some constants
export const NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME = '_';

type NunjucksEnvironment = Environment & {
  extensions: Record<string, any>;
};

// Cached globals
let nunjucksAll: NunjucksEnvironment | null = null;

/**
 * Render text based on stuff
 * @param {String} text - Nunjucks template in text form
 * @param {Object} [config] - Config options for rendering
 * @param {Object} [config.context] - Context to render with
 * @param {Object} [config.path] - Path to include in the error message
 */
export function render(
  text: string,
  config: {
    context?: Record<string, any>;
    path?: string;
    ignoreUndefinedEnvVariable?: boolean;
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
  return new Promise<string | null>(async (resolve, reject) => {
    // NOTE: this is added as a breadcrumb because renderString sometimes hangs
    const id = setTimeout(() => console.log('[templating] Warning: nunjucks failed to respond within 5 seconds'), 5000);
    const nj = await getNunjucks(config.ignoreUndefinedEnvVariable);
    nj?.renderString(text, templatingContext, (err: Error | null, result: any) => {
      clearTimeout(id);
      if (!err) {
        return resolve(result);
      }
      console.warn('[templating] Error rendering template', err);
      const sanitizedMsg = err.message
        .replace(/\(unknown path\)\s/, '')
        .replace(/\[Line \d+, Column \d*]/, '')
        .replace(/^\s*Error:\s*/, '')
        .trim();
      const location = err.message.match(/\[Line (\d+), Column (\d+)*]/);
      const line = location ? parseInt(location[1]) : 1;
      const column = location ? parseInt(location[2]) : 1;
      const reason = err.message.includes('attempted to output null or undefined value') ? 'undefined' : 'error';
      const newError = new RenderError(sanitizedMsg);
      newError.path = path || '';
      newError.message = sanitizedMsg;
      newError.location = {
        line,
        column,
      };
      newError.type = 'render';
      newError.reason = reason;
      // regard as environment variable missing
      if (hasNunjucksInterpolationSymbols && reason === 'undefined') {
        newError.extraInfo = {
          subType: 'environmentVariable',
          undefinedEnvironmentVariables: extractUndefinedVariableKey(text, templatingContext),
        };
      }
      reject(newError);
    });
  });
}

/**
 * Reload Nunjucks environments. Useful for if plugins change.
 */
export function reload() {
  nunjucksAll = null;
}

/**
 * Get definitions of template tags
 */
export async function getTagDefinitions() {
  const env = await getNunjucks();

  return Object.keys(env.extensions)
    .map(k => env.extensions[k])
    .filter(ext => !ext.isDeprecated())
    .sort((a, b) => (a.getPriority() > b.getPriority() ? 1 : -1))
    .map(ext => ({
      name: ext.getTag() || '',
      displayName: ext.getName() || '',
      liveDisplayName: ext.getLiveDisplayName(),
      description: ext.getDescription(),
      disablePreview: ext.getDisablePreview(),
      args: ext.getArgs(),
      actions: ext.getActions(),
    }));
}

async function getNunjucks(ignoreUndefinedEnvVariable?: boolean): Promise<NunjucksEnvironment> {
  let throwOnUndefined = true;
  if (ignoreUndefinedEnvVariable) {
    throwOnUndefined = false;
  } else if (nunjucksAll) {
    return nunjucksAll;
  }

  // ~~~~~~~~~~~~ //
  // Setup Config //
  // ~~~~~~~~~~~~ //
  const config = {
    autoescape: false,
    // Don't escape HTML
    throwOnUndefined,
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

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Create Env with Extensions //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  const nunjucksEnvironment = nunjucks.configure(config) as NunjucksEnvironment;
  nunjucksEnvironment.addGlobal('range', undefined);
  nunjucksEnvironment.addGlobal('cycler', undefined);
  nunjucksEnvironment.addGlobal('joiner', undefined);
  const bundlePluginTemplateTags = (await fetchFromTemplateWorkerDatabase(
    'plugin.getBundlePluginTemplateTags',
    {},
  )) as TemplateTag[];
  bundlePluginTemplateTags.forEach(tag => {
    const { templateTag, plugin } = tag;
    const pluginName = plugin.name;
    const tagName = templateTag.name;
    // default run method to send context, parsed args, plugin name, and tag name to main for execution
    templateTag.run = async (context, ...args) =>
      await fetchFromTemplateWorkerDatabase('plugin.executeBundlePluginTag', { context, args, pluginName, tagName });
  });
  const allExtensions = [...localTemplateTags, ...bundlePluginTemplateTags];

  for (const extension of allExtensions) {
    const { templateTag, plugin } = extension;
    templateTag.priority = templateTag.priority || allExtensions.indexOf(extension);
    const instance = new BaseExtensionWorker(templateTag, plugin);
    nunjucksEnvironment.addExtension(instance.getTag() || '', instance);
    // Hidden helper filter to debug complicated things
    // eg. `{{ foo | urlencode | debug | upper }}`
    nunjucksEnvironment.addFilter('debug', (o: any) => o);
  }

  // ~~~~~~~~~~~~~~~~~~~~ //
  // Cache Env and Return (when ignoreUndefinedEnvVariable is false) //
  // ~~~~~~~~~~~~~~~~~~~~ //
  if (ignoreUndefinedEnvVariable) {
    return nunjucksEnvironment;
  }

  nunjucksAll = nunjucksEnvironment;

  return nunjucksEnvironment;
}
