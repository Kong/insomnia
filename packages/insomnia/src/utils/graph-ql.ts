import { getOperationAST, parse } from 'graphql';

import type { Request } from '~/insomnia-data';

import { CONTENT_TYPE_GRAPHQL } from '../common/constants';
import type { RenderedRequest } from '../templating/types';

// parse graphql request body since we save entire query variables as string rather then stringified json string. - INS-4281
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

export function getOperationType(request: Request) {
  if (request.body?.mimeType === CONTENT_TYPE_GRAPHQL) {
    let documentAST;
    let requestBody;
    try {
      requestBody = JSON.parse(request.body.text || '');
      documentAST = parse(requestBody?.query || '');
    } catch {
      documentAST = null;
    }
    if (documentAST) {
      const operationAST = getOperationAST(documentAST, requestBody?.operationName);
      if (operationAST) {
        return operationAST.operation;
      }
    }
  }
  return;
}
