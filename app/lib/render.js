import nunjucks from 'nunjucks';
import traverse from 'traverse';
import * as db from '../database'
import {TYPE_WORKSPACE} from '../database/index';

nunjucks.configure({
  autoescape: false
});

export function buildRenderContext (ancestors, rootEnvironment, subEnvironment) {
  const renderContext = Object.assign(
    {},
    rootEnvironment.data,
    subEnvironment ? subEnvironment.data : {}
  );

  for (let doc of ancestors) {
    if (doc.type === TYPE_WORKSPACE) {
      continue;
    }

    const environment = doc.environment || {};
    Object.assign(renderContext, environment);
  }

  return renderContext
}

export function recursiveRender (obj, context) {
  // Make a copy so no one gets mad :)
  const newObj = Object.assign({}, obj);

  try {
    traverse(newObj).forEach(function (x) {
      if (typeof x === 'string') {
        this.update(render(x, context));
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

      // Do authentication
      if (renderedRequest.authentication.username) {
        const authHeader = renderedRequest.headers.find(
          h => h.name.toLowerCase() === 'authorization'
        );

        if (!authHeader) {
          const {username, password} = renderedRequest.authentication;
          const header = getBasicAuthHeader(username, password);
          renderedRequest.headers.push(header);
        }
      }

      return new Promise(resolve => resolve(renderedRequest));
    });
  });
}

function render (template, context = {}) {
  try {
    return nunjucks.renderString(template, context);
  } catch (e) {
    throw new Error(
      e.message.replace('(unknown path)\n  ', '')
    );
  }
}

function getBasicAuthHeader (username, password) {
  const name = 'Authorization';
  const header = `${username || ''}:${password || ''}`;
  const authString = new Buffer(header, 'utf8').toString('base64');
  const value = `Basic ${authString}`;
  return {name, value};
}
