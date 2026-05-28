import React, { type FC, memo } from 'react';

import type { GrpcRequest, McpRequest, Request, SocketIORequest, WebSocketRequest } from '~/insomnia-data';
import { models } from '~/insomnia-data';

import { CONTENT_TYPE_GRAPHQL, METHOD_DELETE, METHOD_OPTIONS } from '../../../common/constants';

const { isEventStreamRequest, isRequest } = models.request;

interface Props {
  method: string;
  override?: string | null;
  fullNames?: boolean;
}

function removeVowels(str: string) {
  return str.replace(/[aeiouyAEIOUY]/g, '');
}

const requestBadgeClassNames: Record<string, string> = {
  GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
  POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
  HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
  OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
  DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
  PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
  PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
  WS: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
  IO: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
  gRPC: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
  MCP: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
};

export const getRequestBadgeClassName = (badge: string) => {
  return requestBadgeClassNames[badge] || 'bg-(--hl-md) text-(--color-font)';
};

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

export const getRequestMethodShortHand = (
  doc?: Request | WebSocketRequest | GrpcRequest | SocketIORequest | McpRequest,
) => {
  if (!doc) {
    return '';
  }
  if (isRequest(doc)) {
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
