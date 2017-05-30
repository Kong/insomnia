const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';
import * as models from '../models/index';

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

  getDefaultFill () {
    const args = this.getArgs().map(argDefinition => {
      if (argDefinition.type === 'enum') {
        const {defaultValue, options} = argDefinition;
        const value = defaultValue !== undefined ? defaultValue : options[0].value;
        return `'${value}'`;
      } else if (argDefinition.type === 'number') {
        const {defaultValue} = argDefinition;
        return defaultValue !== undefined ? defaultValue : 0;
      } else {
        const {defaultValue} = argDefinition;
        return defaultValue !== undefined ? `'${defaultValue}'` : "''";
      }
    });

    return `${this.getTag()} ${args.join(', ')}`;
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

  asyncRun (...runArgs) {
    // Pull the callback off the end
    const callback = runArgs[runArgs.length - 1];

    // Only pass render context, not the entire Nunjucks instance
    const renderContext = runArgs[0].ctx;

    // Extract the rest of the args
    const args = runArgs
      .slice(1, runArgs.length - 1)
      .filter(a => a !== EMPTY_ARG);

    // Define a plugin context with helpers
    const pluginContext = {
      context: renderContext,
      models: {
        request: {getById: models.request.getById},
        response: {getLatestForRequestId: models.response.getLatestForRequest}
      }
    };

    let result;
    try {
      result = this.run(pluginContext, ...args);
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
