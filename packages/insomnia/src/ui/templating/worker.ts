import type { Liquid } from 'liquidjs';

import type { TemplateTag } from '~/common/plugins/types';
import { LIQUID_TEMPLATE_GLOBAL_PROPERTY_NAME, NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '~/common/templating/constants';
import { buildLiquidEngine, stripLiquidComments } from '~/common/templating/liquid-engine';
import { createLiquidTagWorker, fetchFromTemplateWorkerDatabase } from '~/common/templating/liquid-extension-worker';
import { localTemplateTags } from '~/common/templating/local-template-tags';
import { extractUndefinedVariableKey, translateLiquidError } from '~/common/templating/render-error';
import type { PluginToMainAPIPaths } from '~/common/templating/types';
export { LIQUID_TEMPLATE_GLOBAL_PROPERTY_NAME, NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME };

// Cached engine instances
let liquidAll: Liquid | null = null;
let liquidAllTagMetadata: Map<string, any> | null = null;

/**
 * Render text based on stuff
 * @param {String} text - Liquid template in text form
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
  const hasTemplateInterpolationSymbols = text.includes('{{') && text.includes('}}');
  const hasTemplateTagSymbols = text.includes('{%') && text.includes('%}');
  const hasTemplateCommentSymbols = text.includes('{#') && text.includes('#}');
  if (!hasTemplateInterpolationSymbols && !hasTemplateTagSymbols && !hasTemplateCommentSymbols) {
    return text;
  }
  const context = config.context || {};
  // context needs to exist on the root for the old templating syntax, and in _ for the new templating syntax
  // old: {{ arr[0].prop }}
  // new: {{ _['arr-name-with-dash'][0].prop }}
  const templatingContext = { ...context, [NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME]: context };
  const path = config.path || null;

  return new Promise<string | null>(async (resolve, reject) => {
    // NOTE: this is added as a breadcrumb because rendering sometimes hangs
    const id = setTimeout(() => console.log('[templating] Warning: liquid failed to respond within 5 seconds'), 5000);
    try {
      const { engine } = await getLiquid(config.ignoreUndefinedEnvVariable);
      const preprocessed = stripLiquidComments(text);
      const result = await engine.parseAndRender(preprocessed, templatingContext);
      clearTimeout(id);
      resolve(result);
    } catch (err: any) {
      clearTimeout(id);
      console.warn('[templating] Error rendering template', err);
      const newError = translateLiquidError(err, text, templatingContext, path);
      if (hasTemplateInterpolationSymbols && newError.reason === 'undefined') {
        newError.extraInfo = {
          subType: 'environmentVariable',
          undefinedEnvironmentVariables: extractUndefinedVariableKey(text, templatingContext),
        };
      }
      reject(newError);
    }
  });
}

/**
 * Reload Liquid engine. Useful when plugins change.
 */
export function reload() {
  liquidAll = null;
  liquidAllTagMetadata = null;
}

/**
 * Get definitions of template tags
 */
export async function getTagDefinitions() {
  const { tagMetadata } = await getLiquid();

  return Array.from(tagMetadata.values())
    .filter(ext => !ext.deprecated)
    .sort((a, b) => (a.priority > b.priority ? 1 : -1))
    .map(ext => ({
      name: ext.name || '',
      displayName: typeof ext.displayName === 'string' ? ext.displayName : ext.name || '',
      liveDisplayName: ext.liveDisplayName || (() => ''),
      description: ext.description,
      disablePreview: ext.disablePreview || (() => false),
      args: ext.args || [],
      actions: ext.actions || [],
    }));
}

// Fetch plugin template tags from main and route each tag's `run` back over IPC, so execution
// happens in the main process where the Node built-ins plugins require (e.g. crypto) are available.
async function fetchAndRoutePluginTags(
  getPath: PluginToMainAPIPaths,
  executePath: PluginToMainAPIPaths,
): Promise<TemplateTag[]> {
  const tags = (await fetchFromTemplateWorkerDatabase(getPath, {})) as TemplateTag[];
  tags.forEach(({ templateTag, plugin }) => {
    const pluginName = plugin.name;
    const tagName = templateTag.name;
    templateTag.run = async (context, ...args) =>
      await fetchFromTemplateWorkerDatabase(executePath, { context, args, pluginName, tagName });
  });
  return tags;
}

async function getLiquid(
  ignoreUndefinedEnvVariable?: boolean,
): Promise<{ engine: Liquid; tagMetadata: Map<string, any> }> {
  if (!ignoreUndefinedEnvVariable && liquidAll && liquidAllTagMetadata) {
    return { engine: liquidAll, tagMetadata: liquidAllTagMetadata };
  }

  // Bundle plugins ship inside the app; user-installed plugins are loaded from disk. Both are
  // registered here so their tags resolve at render time, not just in the editor autocomplete.
  const bundlePluginTemplateTags = await fetchAndRoutePluginTags(
    'plugin.getBundlePluginTemplateTags',
    'plugin.executeBundlePluginTag',
  );
  const userPluginTemplateTags = await fetchAndRoutePluginTags(
    'plugin.getUserPluginTemplateTags',
    'plugin.executeUserPluginTag',
  );

  const allTags = [...localTemplateTags, ...bundlePluginTemplateTags, ...userPluginTemplateTags];

  allTags.forEach((ext, i) => {
    ext.templateTag.priority = ext.templateTag.priority ?? i;
  });

  const { engine, tagMetadata } = buildLiquidEngine({
    strictVariables: !ignoreUndefinedEnvVariable,
    tagFactory: (ext, plugin) => createLiquidTagWorker(ext, plugin, (str, opts) => Promise.resolve(render(str, opts))),
    tags: allTags.map(ext => ({ templateTag: ext.templateTag, plugin: ext.plugin })),
  });

  if (!ignoreUndefinedEnvVariable) {
    liquidAll = engine;
    liquidAllTagMetadata = tagMetadata;
  }

  return { engine, tagMetadata };
}
