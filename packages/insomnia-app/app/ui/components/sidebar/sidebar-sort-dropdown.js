// @flow
import * as React from 'react';
import {
  SortOrder,
  sortOrderName,
  SORT_CREATED_ASC,
  SORT_CREATED_DESC,
  SORT_METHOD,
  SORT_NAME_ASC,
  SORT_NAME_DESC,
  SORT_TYPE_ASC,
  SORT_TYPE_DESC,
} from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';

type Props = {
  handleSort: (sortOrder: SortOrder) => void,
};

const SidebarSortDropdown = (props: Props) => {
  const _handleSort = (order: SortOrder) => {
    props.handleSort(order);
  };

  const _renderSortOrder = (order: SortOrder) => {
    return (
      <DropdownItem onClick={_handleSort} value={order}>
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
      {_renderSortOrder(SORT_CREATED_ASC)}
      {_renderSortOrder(SORT_CREATED_DESC)}
      {_renderSortOrder(SORT_METHOD)}
      {_renderSortOrder(SORT_TYPE_DESC)}
      {_renderSortOrder(SORT_TYPE_ASC)}
    </Dropdown>
  );
};

export default SidebarSortDropdown;
