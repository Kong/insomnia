import { useEffect, useMemo, useRef } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { isRequest, type Request } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { invariant } from '../../utils/invariant';
import { useRunnerContext } from '../context/app/runner-context';
import type { RequestRow } from '../routes/runner';
import type { Child, WorkspaceLoaderData } from '../routes/workspace';

export const useRunnerRequestList = (targetFolderId: string, runnerId: string) => {
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

  const { runnerStateMap, updateRunnerState } = useRunnerContext();

  useEffect(() => {
    if (!runnerStateMap[runnerId]) {
      updateRunnerState(runnerId, {
        reqList: requestRows,
      });
    }
  }, [requestRows, runnerId, runnerStateMap, updateRunnerState]);

  return {
    reqList: runnerStateMap[runnerId]?.reqList || [],
    requestRows,
    entityMap: entityMapRef.current,
  };
};
