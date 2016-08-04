import nunjucks from 'nunjucks';
import * as db from '../database'

nunjucks.configure({
  autoescape: false
});

export function render (template, context = {}) {
  try {
    return nunjucks.renderString(template, context);
  } catch (e) {
    throw new Error(
      e.message.replace('(unknown path)\n  ', '')
    );
  }
}

export function getRenderedRequest (request) {
  return db.requestGetAncestors(request).then(ancestors => {
    const renderContext = {};

    for (let doc of ancestors) {
      // TODO: Add support for Workspace environments
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

    return new Promise(resolve => resolve(renderedRequest));
  });
}
