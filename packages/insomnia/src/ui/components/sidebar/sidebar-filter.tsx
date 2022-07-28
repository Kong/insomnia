import React, { FC, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';

import { SortOrder } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { sortMethodMap } from '../../../common/sorting';
import * as models from '../../../models';
import { isRequestGroup } from '../../../models/request-group';
import { selectActiveWorkspace } from '../../redux/selectors';
import { KeydownBinder } from '../keydown-binder';
import { SidebarCreateDropdown } from './sidebar-create-dropdown';
import { SidebarSortDropdown } from './sidebar-sort-dropdown';

interface Props {
  onChange: (value: string) => Promise<void>;
  filter: string;
}
export const SidebarFilter: FC<Props> = ({ filter, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeWorkspace = useSelector(selectActiveWorkspace);

  const handleClearFilter = useCallback(() => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }, [onChange]);
  const handleOnChange = useCallback((event: React.SyntheticEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.value);
  }, [onChange]);
  const handleKeydown = useCallback((event: KeyboardEvent) => {
    executeHotKey(event, hotKeyRefs.SIDEBAR_FOCUS_FILTER, () => {
      inputRef.current?.focus();
    });
  }, []);
  const sortSidebar = async (order: SortOrder, parentId?: string) => {
    let flushId: number | undefined;
    if (!activeWorkspace) {
      return;
    }
    if (!parentId) {
      parentId = activeWorkspace._id;
      flushId = await db.bufferChanges();
    }
    const docs = [
      ...(await models.requestGroup.findByParentId(parentId)),
      ...(await models.request.findByParentId(parentId)),
      ...(await models.grpcRequest.findByParentId(parentId)),
    ].sort(sortMethodMap[order]);
    // @ts-expect-error -- TSCONVERSION the fetched model will only ever be a RequestGroup, Request, or GrpcRequest
    // Which all have the .update method. How do we better filter types?
    await Promise.all(docs.map((doc, i) => models.getModel(doc.type)?.update(doc, { metaSortKey: i * 100 })));
    // sort RequestGroups recursively
    await Promise.all(docs.filter(isRequestGroup).map(g => sortSidebar(order, g._id)));

    if (flushId) {
      await db.flushChanges(flushId);
    }
  };

  return (
    <KeydownBinder onKeydown={handleKeydown}>
      <div className="sidebar__filter">
        <div className="form-control form-control--outlined form-control--btn-right">
          <input
            ref={inputRef}
            type="text"
            placeholder="Filter"
            defaultValue={filter}
            onChange={handleOnChange}
          />
          {filter && (
            <button className="form-control__right" onClick={handleClearFilter}>
              <i className="fa fa-times-circle" />
            </button>
          )}
        </div>
        <SidebarSortDropdown handleSort={sortSidebar} />
        <SidebarCreateDropdown />
      </div>
    </KeydownBinder>
  );
};
