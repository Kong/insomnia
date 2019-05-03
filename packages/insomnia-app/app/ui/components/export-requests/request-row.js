// @flow
import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import MethodTag from '../tags/method-tag';
import type { Request } from '../../../models/request';

type Props = {
  handleSetItemSelected: Function,
  isSelected: boolean,
  request: Request,
};

@autobind
class RequestRow extends PureComponent<Props> {
  handleSelect(e: SyntheticEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    let value = el.checked;
    const { handleSetItemSelected, request } = this.props;
    return handleSetItemSelected(request._id, value);
  }

  render() {
    const { request, isSelected } = this.props;
    return (
      <li className="tree__row">
        <div className="tree__item tree__item--request">
          <div className="tree__item__checkbox tree__indent">
            <input type="checkbox" checked={isSelected} onChange={this.handleSelect} />
          </div>
          <button className="wide">
            <MethodTag method={request.method} />
            <span className="inline-block">{request.name}</span>
          </button>
        </div>
      </li>
    );
  }
}

export default RequestRow;
