import nunjucks from 'nunjucks';
import traverse from 'traverse';
import uuid from 'uuid';
import * as models from '../models';
import {getBasicAuthHeader, hasAuthHeader, setDefaultProtocol} from './misc';
import * as db from './database';

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

// class ArgsExtension {
//   parse (parser, nodes, lexer) {
//     const tok = parser.nextToken();
//     const args = parser.parseSignature(null, true);
//     parser.advanceAfterBlockEnd(tok.value);
//     return new nodes.CallExtension(this, 'run', args);
//   }
// }

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

export function render (template, context = {}) {
  try {
    return nunjucksEnvironment.renderString(template, context);
  } catch (e) {
    throw new Error(e.message.replace(/\(unknown path\)\s*/, ''));
  }
}

export function buildRenderContext (ancestors, rootEnvironment, subEnvironment) {
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

  // Merge all environments. Note that we're reversing ancestors because we want to merge
  // from top-down (closest ancestor should win)
  for (let doc of ancestors.reverse()) {
    if (!doc.environment) {
      continue;
    }

    Object.assign(renderContext, doc.environment);
  }

  // Now we're going to render the renderContext with itself.
  // This is to support templating inside environments
  return recursiveRender(renderContext, renderContext);
}

export function recursiveRender (obj, context) {
  // Make a copy so no one gets mad :)
  const newObj = traverse.clone(obj);

  traverse(newObj).forEach(function (x) {
    try {
      if (typeof x === 'string') {
        const str = render(x, context);
        this.update(str);
      }
    } catch (e) {
      // Failed to render Request
      const path = this.path.join('.');
      throw new Error(`Failed to render Request.${path}: "${e.message}"`);
    }
  });

  return newObj;
}

export async function getRenderedRequest (request, environmentId) {
  const ancestors = await db.withAncestors(request);
  const workspace = ancestors.find(doc => doc.type === models.workspace.type);

  const rootEnvironment = await models.environment.getOrCreateForWorkspace(workspace);
  const subEnvironment = await models.environment.getById(environmentId);
  const cookieJar = await models.cookieJar.getOrCreateForWorkspace(workspace);

  // Generate the context we need to render
  const renderContext = buildRenderContext(
    ancestors,
    rootEnvironment,
    subEnvironment
  );

  // Render all request properties
  const renderedRequest = recursiveRender(request, renderContext);

  // Remove disabled params
  renderedRequest.parameters = renderedRequest.parameters.filter(p => !p.disabled);

  // Remove disabled headers
  renderedRequest.headers = renderedRequest.headers.filter(p => !p.disabled);

  // Remove disabled body params
  if (renderedRequest.body && Array.isArray(renderedRequest.body.params)) {
    renderedRequest.body.params = renderedRequest.body.params.filter(p => !p.disabled);
  }

  // Remove disabled authentication
  if (renderedRequest.authentication && renderedRequest.authentication.disabled) {
    renderedRequest.authentication = {}
  }

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

  return renderedRequest;
}
