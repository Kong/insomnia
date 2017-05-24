const EMPTY_ARG = '__EMPTY_NUNJUCKS_ARG__';

export default class BaseExtension {
  constructor () {
    this.tags = [this.getTag()];
  }

  getName () {
    throw new Error(`${this.constructor.name} did not implement getName()`);
  }

  getTag () {
    throw new Error(`${this.constructor.name} did not implement getTag()`);
  }

  getDefaultFill () {
    throw new Error(`${this.constructor.name} did not implement getDefaultFill()`);
  }

  getDescription () {
    throw new Error(`${this.constructor.name} did not implement getDescription()`);
  }

  getArguments () {
    throw new Error(`${this.constructor.name} did not implement getArguments()`);
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
    const args = runArgs
      .slice(0, runArgs.length - 1)
      .filter(a => a !== EMPTY_ARG);

    let result;
    try {
      result = this.run(...args);
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
