import { useEffect, useMemo, useRef } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useListData } from 'react-stately';
import { usePrevious } from 'react-use';

import { isRequest, type Request } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { invariant } from '../../utils/invariant';
import type { RequestRow } from '../routes/runner';
import type { Child, WorkspaceLoaderData } from '../routes/workspace';

export const useRunnerRequestList = (workspaceId: string, targetFolderId: string) => {
  const { collection } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const entityMapRef = useRef(new Map<string, Child>());

  const requestRows: RequestRow[] = useMemo(() => {
    return collection
      .filter(item => {
        entityMapRef.current.set(item.doc._id, item);
        return isRequest(item.doc);
      })
      .map((item: Child) => {
        const ancestorNames: string[] = [];
        const ancestorIds: string[] = [];
        if (item.ancestors) {
          item.ancestors.forEach(ancestorId => {
            const ancestor = entityMapRef.current.get(ancestorId);
            if (ancestor && isRequestGroup(ancestor?.doc)) {
              ancestorNames.push(ancestor?.doc.name);
              ancestorIds.push(ancestor?.doc._id);
            }
          });
        }

        const requestDoc = item.doc as Request;
        invariant('method' in item.doc, 'Only Request is supported at the moment');
        return {
          id: item.doc._id,
          name: item.doc.name,
          ancestorNames,
          ancestorIds,
          method: requestDoc.method,
          url: item.doc.url,
          parentId: item.doc.parentId,
        };
      })
      .filter(item => {
        if (targetFolderId) {
          return item.ancestorIds.includes(targetFolderId);
        }
        return true;
      });
  }, [collection, targetFolderId]);

  const reqList = useListData({
    initialItems: requestRows,
  });

  const previousWorkspaceId = usePrevious(workspaceId);
  const previousTargetFolderId = usePrevious(targetFolderId);

  useEffect(() => {
    if ((previousWorkspaceId && previousWorkspaceId !== workspaceId) || (previousTargetFolderId !== undefined && previousTargetFolderId !== targetFolderId)) {
      // reset the list when workspace changes
      const keys = reqList.items.map(item => item.id);
      reqList.remove(...keys);
      reqList.append(...requestRows);
    }
  }, [reqList, requestRows, workspaceId, targetFolderId, previousWorkspaceId, previousTargetFolderId]);

  return {
    reqList,
    requestRows,
    entityMap: entityMapRef.current,
  };
};
