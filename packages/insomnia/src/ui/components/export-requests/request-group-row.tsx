import classnames from 'classnames';
import React, { FC, ReactNode, useRef } from 'react';

import type { RequestGroup } from '../../../models/request-group';

interface Props {
  children?: ReactNode;
  handleSetItemSelected: (...args: any[]) => any;
  handleSetRequestGroupCollapsed: (...args: any[]) => any;
  isCollapsed: boolean;
  requestGroup: RequestGroup;
  selectedRequests: number;
  totalRequests: number;
}
export const RequestGroupRow: FC<Props> = ({
  children,
  handleSetItemSelected,
  handleSetRequestGroupCollapsed,
  isCollapsed,
  requestGroup,
  selectedRequests,
  totalRequests,
}) => {
  const isSelected = selectedRequests === totalRequests;
  const checkboxRef = useRef<HTMLInputElement>(null);
  if (checkboxRef.current) {
    // Partial or indeterminate checkbox.
    checkboxRef.current.indeterminate = selectedRequests > 0 && selectedRequests < totalRequests;
  }

  return (
    <li key={requestGroup._id} className="tree__row">
      <div className="tree__item tree__item--big">
        <div className="tree__item__checkbox tree__indent">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={isSelected}
            onChange={e => handleSetItemSelected(requestGroup._id, e.currentTarget.checked)}
          />
        </div>
        <button onClick={() => handleSetRequestGroupCollapsed(requestGroup._id, !isCollapsed)}>
          <i className={classnames('tree__item__icon', 'fa', `fa-folder${isCollapsed ? '' : '-open'}`)} />
          {requestGroup.name}
          <span className="total-requests">{totalRequests} requests</span>
        </button>
      </div>

      <ul
        className={classnames('tree__list', {
          'tree__list--collapsed': isCollapsed,
        })}
      >
        {!isCollapsed ? children : null}
      </ul>
    </li>
  );
};
