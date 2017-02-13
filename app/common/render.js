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
  if (!Array.isArray(ancestors)) {
    ancestors = [];
  }

  const environments = [];

  if (rootEnvironment) {
    environments.push(rootEnvironment.data);
  }

  if (subEnvironment) {
    environments.push(subEnvironment.data);
  }

  for (const doc of ancestors.reverse()) {
    if (!doc.environment) {
      continue;
    }
    environments.push(doc.environment);
  }

  // At this point, environments is a list of environments ordered
  // from top-most parent to bottom-most child

  const renderContext = {};
  for (const environment of environments) {
    // Do an Object.assign, but render each property as it overwrites. This
    // way we can keep same-name variables from the parent context.
    _objectDeepAssignRender(renderContext, environment);
  }

  // Render the context with itself to fill in the rest.
  let finalRenderContext = renderContext;

  // Render up to 5 levels of recursive references.
  for (let i = 0; i < 3; i++) {
    finalRenderContext = recursiveRender(finalRenderContext, finalRenderContext);
  }

  return finalRenderContext;
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

export async function getRenderContext (request, environmentId, ancestors = null) {
  if (!ancestors) {
    ancestors = await db.withAncestors(request);
  }

  const workspace = ancestors.find(doc => doc.type === models.workspace.type);
  const rootEnvironment = await models.environment.getOrCreateForWorkspace(workspace);
  const subEnvironment = await models.environment.getById(environmentId);

  // Generate the context we need to render
  return buildRenderContext(
    ancestors,
    rootEnvironment,
    subEnvironment
  );
}

export async function getRenderedRequest (request, environmentId) {
  const ancestors = await db.withAncestors(request);
  const workspace = ancestors.find(doc => doc.type === models.workspace.type);
  const cookieJar = await models.cookieJar.getOrCreateForWorkspace(workspace);

  const renderContext = await getRenderContext(request, environmentId, ancestors);

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

function _objectDeepAssignRender (base, obj) {
  for (const key of Object.keys(obj)) {
    /*
     * If we're overwriting a string, try to render it first with the base as
     * a context. This allows for the following scenario:
     *
     * base:  { base_url: 'google.com' }
     * obj:   { base_url: '{{ base_url }}/foo' }
     * final: { base_url: 'google.com/foo' }
     *
     * A regular Object.assign would yield { base_url: '{{ base_url }}/foo' } and the
     * original base_url of google.com would be lost.
     */
    if (typeof base[key] === 'string') {
      base[key] = render(obj[key], base);
    } else {
      base[key] = obj[key];
    }
  }
}
