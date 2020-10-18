// @flow
import autobind from 'autobind-decorator';
import * as React from 'react';
import {
  getSortOrderName,
  SORT_CREATED_FIRST,
  SORT_CREATED_LAST,
  SORT_CUSTOM,
  SORT_METHOD,
  SORT_NAME_ASC,
  SORT_NAME_DESC,
  SORT_TYPE_ASC,
  SORT_TYPE_DESC,
} from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';

type Props = {
  handleSort: Function,
  sortOrder: string,
};

@autobind
class SidebarSortDropdown extends React.PureComponent<Props> {
  _handleSort(order: string) {
    if (order !== this.props.sortOrder) {
      this.props.handleSort(order);
    }
  }

  renderSortOrder(order: string) {
    const currentSortOrder = this.props.sortOrder || SORT_CUSTOM;

    return (
      <DropdownItem onClick={this._handleSort} value={order}>
        {currentSortOrder === order ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}{' '}
        {getSortOrderName(order)}
      </DropdownItem>
    );
  }

  render() {
    return (
      <Dropdown>
        <DropdownButton className="btn btn--compact">
          <i className="fa fa-sort" />
        </DropdownButton>
        {this.renderSortOrder(SORT_NAME_ASC)}
        {this.renderSortOrder(SORT_NAME_DESC)}
        {this.renderSortOrder(SORT_CREATED_FIRST)}
        {this.renderSortOrder(SORT_CREATED_LAST)}
        {this.renderSortOrder(SORT_METHOD)}
        {this.renderSortOrder(SORT_TYPE_ASC)}
        {this.renderSortOrder(SORT_TYPE_DESC)}
      </Dropdown>
    );
  }
}

export default SidebarSortDropdown;
