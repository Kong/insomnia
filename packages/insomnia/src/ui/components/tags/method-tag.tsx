import React, { type FC, memo } from 'react';

import { CONTENT_TYPE_GRAPHQL, METHOD_DELETE, METHOD_OPTIONS } from '../../../common/constants';
import { type GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isEventStreamRequest, isRequest, type Request } from '../../../models/request';
import { isWebSocketRequest, type WebSocketRequest } from '../../../models/websocket-request';

interface Props {
  method: string;
  override?: string | null;
  fullNames?: boolean;
}
function removeVowels(str: string) {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}

export const getMethodShortHand = (doc: Request) => {
  if (isEventStreamRequest(doc)) {
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

export const getRequestMethodShortHand = (doc?: Request | WebSocketRequest | GrpcRequest) => {
  if (!doc) {
    return '';
  }
  if (isRequest(doc)) {
    return getMethodShortHand(doc);
  }

  if (isWebSocketRequest(doc)) {
    return 'WS';
  }

  if (isGrpcRequest(doc)) {
    return 'gRPC';
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
      <div
        className={'tag tag--no-bg tag--small http-method-' + (overrideName ? override : method)}
      >
        <span className="tag__inner">{overrideName || methodName}</span>
      </div>
    </div>
  );
});

MethodTag.displayName = 'MethodTag';
