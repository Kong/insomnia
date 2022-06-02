import React, { FC, SyntheticEvent, useCallback } from 'react';

import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import type { Request } from '../../../models/request';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';

interface Props {
  handleSetItemSelected: (...args: any[]) => any;
  isSelected: boolean;
  request: Request | GrpcRequest;
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
          {isGrpcRequest(request) ? <GrpcTag /> : <MethodTag method={request.method} />}
          <span className="inline-block">{request.name}</span>
        </button>
      </div>
    </li>
  );
};
