import classnames from 'classnames';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { PropsWithChildren } from 'react';

import * as models from '../../../models/index';
import { RequestGroup } from '../../../models/request-group';
import { Highlight } from '../base/highlight';
import { RequestGroupActionsDropdown, RequestGroupActionsDropdownHandle } from '../dropdowns/request-group-actions-dropdown';
import { showModal } from '../modals';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';
import { SidebarRequestRow } from './sidebar-request-row';

interface Props extends PropsWithChildren<{}> {
  filter: string;
  isActive: boolean;
  isCollapsed: boolean;
  requestGroup: RequestGroup;
}
interface SidebarRequestGroupRowHandle {
  getExpandTag: () => HTMLSpanElement | null;
}

export const SidebarRequestGroupRowFC = forwardRef<SidebarRequestGroupRowHandle, Props>(({
  filter,
  children,
  requestGroup,
  isCollapsed,
  isActive,
}, ref) => {
  const dropdownRef = useRef<RequestGroupActionsDropdownHandle>(null);
  const expandTagRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getExpandTag: () => expandTagRef.current,
  }));

  let folderIconClass = 'fa-folder';
  folderIconClass += isCollapsed ? '' : '-open';
  folderIconClass += isActive ? '' : '-o';

  // NOTE: We only want the button draggable, not the whole container (ie. no children)
  const button =
    <button
      onClick={async () => {
        const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroup._id);
        if (requestGroupMeta) {
          models.requestGroupMeta.update(requestGroupMeta, { collapsed: !isCollapsed });
          return;
        }
        models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: false });
      }}
      onContextMenu={event => {
        event.preventDefault();
        dropdownRef.current?.show();
      }}
    >
      <div className="sidebar__clickable">
        <i
          className={classnames(
            'sidebar__item__icon-right',
            'fa',
            'space-right',
            folderIconClass,
          )}
        />
        <Highlight search={filter} text={requestGroup.name} />
        <div
          ref={expandTagRef}
          className={classnames('sidebar__expand', {
            'sidebar__expand-hint': isCollapsed,
          })}
        >
          <div className="tag tag--no-bg tag--small">
            <span className="tag__inner">OPEN</span>
          </div>
        </div>
      </div>
    </button>;
  return (
    <li key={requestGroup._id} className="sidebar__row">
      <div className={classnames('sidebar__item sidebar__item--big', { 'sidebar__item--active': isActive })}>
        {button}
        <div className="sidebar__actions">
          <RequestGroupActionsDropdown
            ref={dropdownRef}
            handleShowSettings={() => showModal(RequestGroupSettingsModal, { requestGroup })}
            requestGroup={requestGroup}
          />
        </div>
      </div>
      <ul className={classnames('sidebar__list', { 'sidebar__list--collapsed': isCollapsed })}>
        {!isCollapsed && React.Children.count(children) > 0 ? children :
          (<SidebarRequestRow
            isActive={false}
            requestGroup={requestGroup}
            filter={filter}
            isPinned={false}
          />)}
      </ul>
    </li>
  );
});
SidebarRequestGroupRowFC.displayName = 'SidebarRequestGroupRowFC';

export const SidebarRequestGroupRow = SidebarRequestGroupRowFC;
