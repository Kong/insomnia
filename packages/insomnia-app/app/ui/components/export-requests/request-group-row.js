// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import type { RequestGroup } from '../../../models/request-group';

type Props = {
  // Required.
  handleSetRequestGroupCollapsed: Function,
  handleSetItemSelected: Function,
  isCollapsed: boolean,
  totalRequests: number,
  selectedRequests: number,
  requestGroup: RequestGroup,

  // Optional.
  children?: React.Node,
};

@autobind
class RequestGroupRow extends React.PureComponent<Props> {
  checkbox: HTMLInputElement;

  setCheckboxRef(checkbox: ?HTMLInputElement) {
    if (checkbox != null) {
      this.checkbox = checkbox;
    }
  }

  handleCollapse() {
    const { requestGroup, handleSetRequestGroupCollapsed, isCollapsed } = this.props;
    handleSetRequestGroupCollapsed(requestGroup._id, !isCollapsed);
  }

  handleSelect(e: SyntheticEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    let value = el.checked;
    const { handleSetItemSelected, requestGroup } = this.props;
    return handleSetItemSelected(requestGroup._id, value);
  }

  render() {
    const { children, requestGroup, isCollapsed, totalRequests, selectedRequests } = this.props;

    let folderIconClass = 'fa-folder';

    folderIconClass += isCollapsed ? '' : '-open';

    const isSelected = selectedRequests === totalRequests;
    if (this.checkbox != null) {
      // Partial or indeterminate checkbox.
      this.checkbox.indeterminate = selectedRequests > 0 && selectedRequests < totalRequests;
    }

    return (
      <li key={requestGroup._id} className="tree__row">
        <div className="tree__item tree__item--big">
          <div className="tree__item__checkbox tree__indent">
            <input
              ref={this.setCheckboxRef}
              type="checkbox"
              checked={isSelected}
              onChange={this.handleSelect}
            />
          </div>
          <button onClick={this.handleCollapse}>
            <i className={'tree__item__icon fa ' + folderIconClass} />
            {requestGroup.name}
            <span className="total-requests">{totalRequests} requests</span>
          </button>
        </div>

        <ul
          className={classnames('tree__list', {
            'tree__list--collapsed': isCollapsed,
          })}>
          {!isCollapsed ? children : null}
        </ul>
      </li>
    );
  }
}

export default RequestGroupRow;
