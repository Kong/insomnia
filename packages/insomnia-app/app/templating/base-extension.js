import * as models from '../models/index';
import * as templating from './index';

const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';

export default class BaseExtension {
  constructor (ext) {
    this._ext = ext;
    this.tags = [this.getTag()];
  }

  getTag () {
    return this._ext.name;
  }

  getPriority () {
    return this._ext.priority || -1;
  }

  getName () {
    return this._ext.displayName || this.getTag();
  }

  getDescription () {
    return this._ext.description || 'no description';
  }

  getArgs () {
    return this._ext.args || [];
  }

  isDeprecated () {
    return this._ext.deprecated || false;
  }

  run (...args) {
    return this._ext.run(...args);
  }

  parse (parser, nodes, lexer) {
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

  asyncRun ({ctx: renderContext}, ...runArgs) {
    // Pull the callback off the end
    const callback = runArgs[runArgs.length - 1];

    // Pull out the meta helper
    const renderMeta = renderContext.getMeta ? renderContext.getMeta() : {};

    // Extract the rest of the args
    const args = runArgs
      .slice(0, runArgs.length - 1)
      .filter(a => a !== EMPTY_ARG);

    // Define a helper context with utils
    const helperContext = {
      context: renderContext,
      meta: renderMeta,
      util: {
        render: str => templating.render(str, {context: renderContext}),
        models: {
          request: {getById: models.request.getById},
          workspace: {getById: models.workspace.getById},
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
      callback(err);
      return;
    }

    // If the result is a promise, resolve it async
    if (result instanceof Promise) {
      result.then(
        r => callback(null, r),
        err => callback(err)
      );
      return;
    }

    // If the result is not a Promise, return it synchronously
    callback(null, result);
  }
}
