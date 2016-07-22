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
  return db.requestGroupGetById(request.parentId).then(requestGroup => {
    const environment = requestGroup ? requestGroup.environment : {};
    let renderedRequest = null;

    if (environment) {
      let template;

      try {
        template = JSON.stringify(request);
      } catch (e) {
        // Failed to parse Request as JSON
        throw new Error(`Bad Request: "${e.message}"`);
      }

      let renderedJSON;
      try {
        renderedJSON = render(template, environment);
      } catch (e) {
        // Failed to render Request
        throw new Error(`Render Failed: "${e.message}"`);
      }

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
    }
  });
}
