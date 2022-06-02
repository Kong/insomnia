import React, { FC } from 'react';

import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import type { Request } from '../../../models/request';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';

interface Props {
  handleSetItemSelected: (...args: any[]) => any;
  isSelected: boolean;
  request: Request | GrpcRequest;
}

export const RequestRow: FC<Props> = props => {
  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const value = el.checked;
    const {
      handleSetItemSelected,
      request,
    } = props;
    return handleSetItemSelected(request._id, value);
  };

  const {
    request,
    isSelected,
  } = props;
  const isGrpc = isGrpcRequest(request);
  return <li className="tree__row">
    <div className="tree__item tree__item--request">
      <div className="tree__item__checkbox tree__indent">
        <input type="checkbox" checked={isSelected} onChange={handleSelect} />
      </div>
      <button className="wide">
        {isGrpc ? <GrpcTag /> : <MethodTag method={request.method} />}
        <span className="inline-block">{request.name}</span>
      </button>
    </div>
  </li>;
};
