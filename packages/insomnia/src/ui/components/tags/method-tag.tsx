import { type McpRequest, models } from 'insomnia-data';
import { type GrpcRequest, type Request, type SocketIORequest, type WebSocketRequest } from 'insomnia-data';
import React, { type FC, memo } from 'react';

import { CONTENT_TYPE_GRAPHQL, METHOD_DELETE, METHOD_OPTIONS } from '../../../common/constants';

interface Props {
  method: string;
  override?: string | null;
  fullNames?: boolean;
}
function removeVowels(str: string) {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}

export const getMethodShortHand = (doc: Request) => {
  if (models.request.isEventStreamRequest(doc)) {
    return 'SSE';
  }
  const isGraphQL = doc.body?.mimeType === CONTENT_TYPE_GRAPHQL;
  if (isGraphQL) {
    return 'GQL';
  }
  return formatMethodName(doc.method);
};
export function formatMethodName(method: string) {
  let methodName = method || '';

  if (method === METHOD_DELETE || method === METHOD_OPTIONS) {
    methodName = method.slice(0, 3);
  } else if (method.length > 4) {
    methodName = removeVowels(method).slice(0, 4);
  }

  return methodName;
}

export const getRequestMethodShortHand = (
  doc?: Request | WebSocketRequest | GrpcRequest | SocketIORequest | McpRequest,
) => {
  if (!doc) {
    return '';
  }
  if (models.request.isRequest(doc)) {
    return getMethodShortHand(doc);
  }

  if (models.webSocketRequest.isWebSocketRequest(doc)) {
    return 'WS';
  }

  if (models.grpcRequest.isGrpcRequest(doc)) {
    return 'gRPC';
  }

  if (models.socketIORequest.isSocketIORequest(doc)) {
    return 'IO';
  }

  if (models.mcpRequest.isMcpRequest(doc)) {
    return 'MCP';
  }

  return '';
};

export const MethodTag: FC<Props> = memo(({ method, override, fullNames }) => {
  let methodName = method;
  let overrideName = override;

  if (!fullNames) {
    methodName = formatMethodName(method);
    overrideName = override ? formatMethodName(override) : override;
  }

  return (
    <div
      style={{
        position: 'relative',
      }}
    >
      {overrideName && (
        <div className={'tag tag--no-bg tag--superscript http-method-' + method}>
          <span>{methodName}</span>
        </div>
      )}
      <div className={'tag tag--no-bg tag--small http-method-' + (overrideName ? override : method)}>
        <span className="tag__inner">{overrideName || methodName}</span>
      </div>
    </div>
  );
});

MethodTag.displayName = 'MethodTag';
