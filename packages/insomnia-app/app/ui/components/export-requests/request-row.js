// @flow
import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import MethodTag from '../tags/method-tag';
import type { Request } from '../../../models/request';
import type { GrpcRequest } from '../../../models/grpc-request';
import { isGrpcRequest } from '../../../models/helpers/is-model';
import GrpcTag from '../tags/grpc-tag';

type Props = {
  handleSetItemSelected: Function,
  isSelected: boolean,
  request: Request | GrpcRequest,
};

@autobind
class RequestRow extends PureComponent<Props> {
  handleSelect(e: SyntheticEvent<HTMLInputElement>) {
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
            {isGrpc ? <GrpcTag /> : <MethodTag method={request.method} />}
            <span className="inline-block">{request.name}</span>
          </button>
        </div>
      </li>
    );
  }
}

export default RequestRow;
