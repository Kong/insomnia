import nunjucks from 'nunjucks';
import * as db from '../database'
import {TYPE_WORKSPACE} from '../database/index';

nunjucks.configure({
  autoescape: false
});

export function getRenderedRequest (request) {
  return db.requestGetAncestors(request).then(ancestors => {
    const workspace = ancestors.find(doc => doc.type === TYPE_WORKSPACE);

    return Promise.all([
      db.environmentGetOrCreateForWorkspace(workspace),
      db.environmentGetById(workspace.metaActiveEnvironmentId),
      db.cookieJarGetOrCreateForWorkspace(workspace)
    ]).then(([rootEnvironment, subEnvironment, cookieJar]) => {
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

      let template;

      try {
        template = JSON.stringify(request);
      } catch (e) {
        // Failed to parse Request as JSON
        throw new Error(`Bad Request: "${e.message}"`);
      }

      let renderedJSON;
      try {
        renderedJSON = render(template, renderContext);
      } catch (e) {
        // Failed to render Request
        throw new Error(`Render Failed: "${e.message}"`);
      }

      let renderedRequest = null;
      try {
        renderedRequest = JSON.parse(renderedJSON);
      } catch (e) {
        // Failed to parse rendered request
        throw new Error(`Parse Failed: "${e.message}"`);
      }

      // Default the proto if it doesn't exist
      if (renderedRequest.url.indexOf('://') === -1) {
        renderedRequest.url = `http://${renderedRequest.url}`;
      }

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
