import nunjucks from 'nunjucks';
import traverse from 'traverse';
import * as db from '../database';
import {TYPE_WORKSPACE} from '../database/index';
import {getBasicAuthHeader, hasAuthHeader} from './util';

nunjucks.configure({
  autoescape: false
});

export function render (template, context = {}) {
  try {
    return nunjucks.renderString(template, context);
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

  for (let doc of ancestors) {
    if (!doc.environment) {
      continue;
    }

    Object.assign(renderContext, doc.environment);
  }

  return renderContext
}

export function recursiveRender (obj, context) {
  // Make a copy so no one gets mad :)
  const newObj = traverse.clone(obj);

  try {
    traverse(newObj).forEach(function (x) {
      if (typeof x === 'string') {
        const str = render(x, context);
        this.update(str);
      }
    });
  } catch (e) {
    // Failed to render Request
    throw new Error(`Render Failed: "${e.message}"`);
  }

  return newObj;
}

export function setDefaultProtocol (url, defaultProto = 'http:') {
  // Default the proto if it doesn't exist
  if (url.indexOf('://') === -1) {
    url = `${defaultProto}//${url}`;
  }

  return url;
}

export function getRenderedRequest (request) {
  return db.requestGetAncestors(request).then(ancestors => {
    const workspace = ancestors.find(doc => doc.type === TYPE_WORKSPACE);

    return Promise.all([
      db.environmentGetOrCreateForWorkspace(workspace),
      db.environmentGetById(workspace.metaActiveEnvironmentId),
      db.cookieJarGetOrCreateForWorkspace(workspace)
    ]).then(([rootEnvironment, subEnvironment, cookieJar]) => {

      // Generate the context we need to render
      const renderContext = buildRenderContext(
        ancestors,
        rootEnvironment,
        subEnvironment
      );

      // Render all request properties
      const renderedRequest = recursiveRender(
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
}
