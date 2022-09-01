import React, { FC, SyntheticEvent, useCallback } from 'react';

import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';
import { WebSocketTag } from '../tags/websocket-tag';

interface Props {
  handleSetItemSelected: (...args: any[]) => any;
  isSelected: boolean;
  request: Request | WebSocketRequest | GrpcRequest;
}

export const RequestRow: FC<Props> = ({
  handleSetItemSelected,
  request,
  isSelected,
}) => {
  const onChange = useCallback((event: SyntheticEvent<HTMLInputElement>) => {
    handleSetItemSelected(request._id, event?.currentTarget.checked);
  }, [handleSetItemSelected, request._id]);

  return (
    <li className="tree__row">
      <div className="tree__item tree__item--request">
        <div className="tree__item__checkbox tree__indent">
          <input type="checkbox" checked={isSelected} onChange={onChange} />
        </div>
        <button className="wide">
          {isRequest(request) ? <MethodTag method={request.method} /> : null}
          {isGrpcRequest(request) ? <GrpcTag /> : null}
          {isWebSocketRequest(request) ? <WebSocketTag /> : null}
          <span className="inline-block">{request.name}</span>
        </button>
      </div>
    </li>
  );
};
