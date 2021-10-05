import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import type { Request } from '../../../models/request';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';

interface Props {
  handleSetItemSelected: (...args: any[]) => any;
  isSelected: boolean;
  request: Request | GrpcRequest;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class RequestRow extends PureComponent<Props> {
  handleSelect(e: React.SyntheticEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const value = el.checked;
    const { handleSetItemSelected, request } = this.props;
    return handleSetItemSelected(request._id, value);
  }

  render() {
    const { request, isSelected } = this.props;
    const isGrpc = isGrpcRequest(request);
    return (
      <li className="tree__row">
        <div className="tree__item tree__item--request">
          <div className="tree__item__checkbox tree__indent">
            <input type="checkbox" checked={isSelected} onChange={this.handleSelect} />
          </div>
          <button className="wide">
            {isGrpc ? (
              <GrpcTag />
            ) : (
            // @ts-expect-error -- TSCONVERSION
              <MethodTag method={request.method} />
            )}
            <span className="inline-block">{request.name}</span>
          </button>
        </div>
      </li>
    );
  }
}
