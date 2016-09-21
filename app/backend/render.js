'use strict';

const nunjucks = require('nunjucks');
const traverse = require('traverse');
const uuid = require('node-uuid');
const db = require('./database');
const {TYPE_WORKSPACE} = require('./database/index');
const {getBasicAuthHeader, hasAuthHeader, setDefaultProtocol} = require('./util');

const nunjucksEnvironment = nunjucks.configure({
  autoescape: false
});

class NoArgsExtension {
  parse (parser, nodes, lexer) {
    const args = parser.parseSignature(null, true);
    parser.skip(lexer.TOKEN_BLOCK_END);
    return new nodes.CallExtension(this, 'run', args);
  }
}

class ArgsExtension {
  parse (parser, nodes, lexer) {
    const tok = parser.nextToken();
    const args = parser.parseSignature(null, true);
    parser.advanceAfterBlockEnd(tok.value);
    return new nodes.CallExtension(this, 'run', args);
  }
}

class TimestampExtension extends NoArgsExtension {
  constructor () {
    super();
    this.tags = ['timestamp'];
  }

  run (context) {
    return Date.now();
  }
}

class UuidExtension extends NoArgsExtension {
  constructor () {
    super();
    this.tags = ['uuid'];
  }

  run (context) {
    return uuid.v4();
  }
}

nunjucksEnvironment.addExtension('uuid', new UuidExtension());
nunjucksEnvironment.addExtension('timestamp', new TimestampExtension());

module.exports.render = (template, context = {}) => {
  try {
    return nunjucksEnvironment.renderString(template, context);
  } catch (e) {
    throw new Error(e.message.replace(/\(unknown path\)\s*/, ''));
  }
};

module.exports.buildRenderContext = (ancestors, rootEnvironment, subEnvironment) => {
  const renderContext = {};

  if (rootEnvironment) {
    Object.assign(renderContext, rootEnvironment.data);
  }

  if (subEnvironment) {
    Object.assign(renderContext, subEnvironment.data);
  }

  if (!Array.isArray(ancestors)) {
    ancestors = [];
  }

  for (let doc of ancestors) {
    if (!doc.environment) {
      continue;
    }

    Object.assign(renderContext, doc.environment);
  }

  // Now we're going to render the renderContext with itself.
  // This is to support templating inside environments
  const stringifiedEnvironment = JSON.stringify(renderContext);
  return JSON.parse(
    module.exports.render(stringifiedEnvironment, renderContext)
  );
};

module.exports.recursiveRender = (obj, context) => {
  // Make a copy so no one gets mad :)
  const newObj = traverse.clone(obj);

  try {
    traverse(newObj).forEach(function (x) {
      if (typeof x === 'string') {
        const str = module.exports.render(x, context);
        this.update(str);
      }
    });
  } catch (e) {
    // Failed to render Request
    throw new Error(`Render Failed: "${e.message}"`);
  }

  return newObj;
};

module.exports.getRenderedRequest = request => {
  return db.requestGetAncestors(request).then(ancestors => {
    const workspace = ancestors.find(doc => doc.type === TYPE_WORKSPACE);

    return Promise.all([
      db.environmentGetOrCreateForWorkspace(workspace),
      db.environmentGetById(workspace.metaActiveEnvironmentId),
      db.cookieJarGetOrCreateForWorkspace(workspace)
    ]).then(([rootEnvironment, subEnvironment, cookieJar]) => {

      // Generate the context we need to render
      const renderContext = module.exports.buildRenderContext(
        ancestors,
        rootEnvironment,
        subEnvironment
      );

      // Render all request properties
      const renderedRequest = module.exports.recursiveRender(
        request,
        renderContext
      );

      // Default the proto if it doesn't exist
      renderedRequest.url = setDefaultProtocol(renderedRequest.url);

      // Add the yummy cookies
      renderedRequest.cookieJar = cookieJar;

      // Add authentication
      const missingAuthHeader = !hasAuthHeader(renderedRequest.headers);
      if (missingAuthHeader && renderedRequest.authentication.username) {
        const {username, password} = renderedRequest.authentication;
        const header = getBasicAuthHeader(username, password);

        renderedRequest.headers.push(header);
      }

      return new Promise(resolve => resolve(renderedRequest));
    });
  });
};
