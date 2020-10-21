// @flow
import * as React from 'react';
import {
  SortOrder,
  sortOrderName,
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
  handleSort: (sortOrder: SortOrder) => void,
  sortOrder: SortOrder,
};

const SidebarSortDropdown = (props: Props) => {
  const _handleSort = (order: SortOrder) => {
    if (order !== props.sortOrder) {
      props.handleSort(order);
    }
  };

  const _renderSortOrder = (order: SortOrder) => {
    const currentSortOrder = props.sortOrder || SORT_CUSTOM;

    return (
      <DropdownItem onClick={_handleSort} value={order}>
        {currentSortOrder === order ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}{' '}
        {sortOrderName[order]}
      </DropdownItem>
    );
  };

  return (
    <Dropdown>
      <DropdownButton className="btn btn--compact">
        <i className="fa fa-sort" />
      </DropdownButton>
      {_renderSortOrder(SORT_NAME_ASC)}
      {_renderSortOrder(SORT_NAME_DESC)}
      {_renderSortOrder(SORT_CREATED_FIRST)}
      {_renderSortOrder(SORT_CREATED_LAST)}
      {_renderSortOrder(SORT_METHOD)}
      {_renderSortOrder(SORT_TYPE_ASC)}
      {_renderSortOrder(SORT_TYPE_DESC)}
    </Dropdown>
  );
};

export default SidebarSortDropdown;
