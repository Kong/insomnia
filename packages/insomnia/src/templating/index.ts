import type { Environment } from 'nunjucks';
import nunjucks from 'nunjucks/browser/nunjucks';

import { database as db } from '../common/database';
import * as models from '../models/index';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { Workspace } from '../models/workspace';
import * as pluginContexts from '../plugins/context';
import { localTemplateTags } from '../ui/components/templating/local-template-tags';
import type { PluginTemplateTag } from './extensions';
import * as templating from './index';
import { decodeEncoding, extractUndefinedVariableKey, type HelperContext, RenderError } from './render-error';

// Some constants
export const RENDER_ALL = 'all';
export const RENDER_VARS = 'variables';
export const RENDER_TAGS = 'tags';
export const NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME = '_';

type NunjucksEnvironment = Environment & {
  extensions: Record<string, any>;
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
  const renderMode = config.renderMode || RENDER_ALL;
  return new Promise<string | null>(async (resolve, reject) => {
    // NOTE: this is added as a breadcrumb because renderString sometimes hangs
    const id = setTimeout(() => console.log('[templating] Warning: nunjucks failed to respond within 5 seconds'), 5000);
    const nj = await getNunjucks(renderMode, config.ignoreUndefinedEnvVariable);
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

async function getNunjucks(renderMode: string, ignoreUndefinedEnvVariable?: boolean): Promise<NunjucksEnvironment> {
  let throwOnUndefined = true;
  if (ignoreUndefinedEnvVariable) {
    throwOnUndefined = false;
  } else {
    if (renderMode === RENDER_VARS && nunjucksVariablesOnly) {
      return nunjucksVariablesOnly;
    }
    if (renderMode === RENDER_TAGS && nunjucksTagsOnly) {
      return nunjucksTagsOnly;
    }
    if (renderMode === RENDER_ALL && nunjucksAll) {
      return nunjucksAll;
    }
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
  const pluginTemplateTags = await (await import('../plugins')).getTemplateTags();

  const allExtensions = [
    ...localTemplateTags,

    // Spread after local tags to allow plugins to override them.
    // TODO: Determine if this is in fact the behavior we've explicitly decided to support.
    ...pluginTemplateTags,
  ];

  for (const extension of allExtensions) {
    const { templateTag, plugin } = extension;
    templateTag.priority = templateTag.priority || allExtensions.indexOf(extension);
    // @ts-expect-error -- TODO
    const instance = new BaseExtension(templateTag, plugin);
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
  if (renderMode === RENDER_VARS) {
    nunjucksVariablesOnly = nunjucksEnvironment;
  } else if (renderMode === RENDER_TAGS) {
    nunjucksTagsOnly = nunjucksEnvironment;
  } else {
    nunjucksAll = nunjucksEnvironment;
  }

  return nunjucksEnvironment;
}

const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';

class BaseExtension {
  _ext: PluginTemplateTag | null = null;
  _plugin: Plugin | null = null;
  tags: PluginTemplateTag['name'][] = [];

  constructor(ext: PluginTemplateTag, plugin: Plugin) {
    this._ext = ext;
    this._plugin = plugin;
    const tag = this.getTag();
    this.tags = [
      ...(tag === null ? [] : [tag]),
    ];
  }

  getTag() {
    return this._ext?.name || null;
  }

  getPriority() {
    return this._ext?.priority || -1;
  }

  getName() {
    return typeof this._ext?.displayName === 'string' ? this._ext?.displayName : this.getTag();
  }

  getDescription() {
    return this._ext?.description || 'no description';
  }

  getLiveDisplayName() {
    return (
      // @ts-expect-error -- TSCONVERSION
      this._ext?.liveDisplayName ||
      (() => '')
    );
  }

  getDisablePreview() {
    return this._ext?.disablePreview || (() => false);
  }

  getArgs() {
    return this._ext?.args || [];
  }

  getActions() {
    return this._ext?.actions || [];
  }

  isDeprecated() {
    return this._ext?.deprecated || false;
  }

  run(...args: any[]) {
    // @ts-expect-error -- TSCONVERSION
    return this._ext?.run(...args);
  }

  parse(parser: any, nodes: any, lexer: any) {
    const tok = parser.nextToken();
    let args;

    if (parser.peekToken().type !== lexer.TOKEN_BLOCK_END) {
      args = parser.parseSignature(null, true);
    } else {
      // Not sure why this is needed, but it fails without it
      args = new nodes.NodeList(tok.lineno, tok.colno);
      args.addChild(new nodes.Literal(0, 0, EMPTY_ARG));
    }

    parser.advanceAfterBlockEnd(tok.value);
    return new nodes.CallExtensionAsync(this, 'asyncRun', args);
  }

  asyncRun({ ctx: renderContext }: any, ...runArgs: any[]) {
    // Pull the callback off the end
    const callback = runArgs[runArgs.length - 1];
    // Pull out the meta helper
    const renderMeta = renderContext.getMeta ? renderContext.getMeta() : {};
    // Pull out the purpose
    const renderPurpose = renderContext.getPurpose ? renderContext.getPurpose() : null;
    // Extract the rest of the args
    const args = runArgs
      .slice(0, runArgs.length - 1)
      .filter(a => a !== EMPTY_ARG)
      .map(decodeEncoding);
    // Define a helper context with utils
    const helperContext: HelperContext = {
      ...pluginContexts.app.init(renderPurpose),
      // @ts-expect-error -- TSCONVERSION
      ...pluginContexts.store.init(this._plugin),
      ...pluginContexts.network.init(),
      context: renderContext,
      meta: renderMeta,
      renderPurpose,
      util: {
        render: (str: string) =>
          templating.render(str, {
            context: renderContext,
          }),
        models: {
          request: {
            getById: models.request.getById,
            getAncestors: async (request: any) => {
              const ancestors = await db.withAncestors<Request | RequestGroup | Workspace>(request, [
                models.requestGroup.type,
                models.workspace.type,
              ]);
              return ancestors.filter(doc => doc._id !== request._id);
            },
          },
          workspace: {
            getById: models.workspace.getById,
          },
          oAuth2Token: {
            getByRequestId: models.oAuth2Token.getByParentId,
          },
          cookieJar: {
            getOrCreateForWorkspace: (workspace: any) => {
              return models.cookieJar.getOrCreateForParentId(workspace._id);
            },
          },
          response: {
            getLatestForRequestId: models.response.getLatestForRequest,
            getBodyBuffer: models.response.getBodyBuffer,
          },
        },
      },
    };
    let result;

    try {
      result = this.run(helperContext, ...args);
    } catch (err) {
      // Catch sync errors
      callback(err);
      return;
    }

    // FIX THIS: this is throwing unhandled exceptions
    // If the result is a promise, resolve it async
    if (result instanceof Promise) {
      result
        .then(r => {
          callback(null, r);
        })
        .catch(err => {
          callback(err);
        });
      return;
    }

    // If the result is not a Promise, return it synchronously
    callback(null, result);
  }
}
