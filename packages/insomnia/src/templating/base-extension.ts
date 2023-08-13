import { database as db } from '../common/database';
import * as models from '../models/index';
import * as pluginContexts from '../plugins/context';
import { PluginTemplateTag } from './extensions';
import * as templating from './index';
import { decodeEncoding } from './utils';

const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';
export interface HelperContext {
  context: any;
  meta: any;
  renderPurpose: any;
  util: any;
}
export default class BaseExtension {
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
      function() {
        return '';
      }
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
              const ancestors = await db.withAncestors(request, [
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
