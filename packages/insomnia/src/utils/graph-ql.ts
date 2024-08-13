import { CONTENT_TYPE_GRAPHQL } from '../common/constants';
import type { RenderedRequest } from '../common/render';

// parse graphql request body since we save entire query variables as string rather then stringified json string
// see: https://linear.app/insomnia/issue/INS-4281/[bug]-graphql-issues
export function parseGraphQLReqeustBody(renderedRequest: RenderedRequest) {
  if (renderedRequest && renderedRequest.body?.text && renderedRequest.body?.mimeType === CONTENT_TYPE_GRAPHQL) {
    try {
      const parsedBody = JSON.parse(renderedRequest.body.text);
      if (typeof parsedBody.variables === 'string') {
        parsedBody.variables = JSON.parse(parsedBody.variables);
        renderedRequest.body.text = JSON.stringify(parsedBody, null, 2);
      }
    } catch (e) {
      console.error('Failed to parse GraphQL variables', e);
    }
  }
}
