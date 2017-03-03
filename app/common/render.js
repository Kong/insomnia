import clone from 'clone';
import * as models from '../models';
import {getBasicAuthHeader, hasAuthHeader, setDefaultProtocol} from './misc';
import * as db from './database';
import * as templating from '../templating';

export function render (obj, context = {}, strict = false) {
  return recursiveRender(obj, context, strict);
}

export async function buildRenderContext (ancestors, rootEnvironment, subEnvironment) {
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
    await _objectDeepAssignRender(renderContext, environment);
  }

  // Render the context with itself to fill in the rest.
  let finalRenderContext = renderContext;

  // Render up to 5 levels of recursive references.
  for (let i = 0; i < 3; i++) {
    finalRenderContext = await recursiveRender(finalRenderContext, finalRenderContext);
  }

  return finalRenderContext;
}

/**
 * Recursively render any JS object and return a new one
 * @param {*} originalObj - object to render
 * @param {object} context - context to render against
 * @param strict - whether to fail on undefined
 * @return {Promise.<*>}
 */
export async function recursiveRender (originalObj, context = {}, strict = false) {
  const obj = clone(originalObj);
  const toS = obj => Object.prototype.toString.call(obj);

  // Make a copy so no one gets mad :)
  async function next (x) {
    // Leave these types alone
    if (
      toS(x) === '[object Date]' ||
      toS(x) === '[object RegExp]' ||
      toS(x) === '[object Error]' ||
      toS(x) === '[object Boolean]' ||
      toS(x) === '[object Number]' ||
      toS(x) === '[object Null]' ||
      toS(x) === '[object Undefined]'
    ) {
      // Do nothing to these types
    } else if (toS(x) === '[object String]') {
      try {
        x = await templating.render(x, {context, strict});
      } catch (err) {
        // TODO: Show paths here in errors
        throw err;
      }
    } else if (Array.isArray(x)) {
      for (let i = 0; i < x.length; i++) {
        x[i] = await next(x[i]);
      }
    } else if (typeof x === 'object') {
      const keys = Object.keys(x);
      for (const key of keys) {
        x[key] = await next(x[key]);
      }
    }

    return x;
  }

  return next(obj);
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
  const renderedRequest = await recursiveRender(request, renderContext);

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
    renderedRequest.authentication = {};
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

async function _objectDeepAssignRender (base, obj) {
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
      base[key] = await render(obj[key], base);
    } else {
      base[key] = obj[key];
    }
  }
}
