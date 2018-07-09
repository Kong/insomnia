import * as models from '../models/index';
import * as templating from './index';
import * as pluginContexts from '../plugins/context';
import * as db from '../common/database';

const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';

export default class BaseExtension {
  constructor(ext, plugin) {
    this._ext = ext;
    this._plugin = plugin;
    this.tags = [this.getTag()];
  }

  getTag() {
    return this._ext.name;
  }

  getPriority() {
    return this._ext.priority || -1;
  }

  getName() {
    return this._ext.displayName || this.getTag();
  }

  getDescription() {
    return this._ext.description || 'no description';
  }

  getArgs() {
    return this._ext.args || [];
  }

  isDeprecated() {
    return this._ext.deprecated || false;
  }

  run(...args) {
    return this._ext.run(...args);
  }

  parse(parser, nodes, lexer) {
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

  asyncRun({ ctx: renderContext }, ...runArgs) {
    // Pull the callback off the end
    const callback = runArgs[runArgs.length - 1];

    // Pull out the meta helper
    const renderMeta = renderContext.getMeta ? renderContext.getMeta() : {};

    // Pull out the purpose
    const renderPurpose = renderContext.getPurpose
      ? renderContext.getPurpose()
      : null;

    // Extract the rest of the args
    const args = runArgs
      .slice(0, runArgs.length - 1)
      .filter(a => a !== EMPTY_ARG);

    // Define a helper context with utils
    const helperContext = {
      ...pluginContexts.app.init(renderPurpose),
      ...pluginContexts.store.init(this._plugin),
      context: renderContext,
      meta: renderMeta,
      util: {
        render: str => templating.render(str, { context: renderContext }),
        models: {
          request: {
            getById: models.request.getById,
            getAncestors: async request => {
              const ancestors = await db.withAncestors(request, [
                models.requestGroup.type,
                models.workspace.type
              ]);
              return ancestors.filter(doc => doc._id !== request._id);
            }
          },
          workspace: { getById: models.workspace.getById },
          oAuth2Token: { getByRequestId: models.oAuth2Token.getByParentId },
          cookieJar: {
            getOrCreateForWorkspace: workspace => {
              return models.cookieJar.getOrCreateForParentId(workspace._id);
            }
          },
          response: {
            getLatestForRequestId: models.response.getLatestForRequest,
            getBodyBuffer: models.response.getBodyBuffer
          }
        }
      }
    };

    let result;
    try {
      result = this.run(helperContext, ...args);
    } catch (err) {
      // Catch sync errors
      callback(err);
      return;
    }

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
