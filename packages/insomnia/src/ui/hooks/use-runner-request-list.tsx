import type { Request } from 'insomnia-data';
import { models } from 'insomnia-data';
import { useEffect, useMemo, useRef } from 'react';

import type { RequestRow } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner';
import { useRunnerContext } from '~/ui/context/app/runner-context';
import { invariant } from '~/utils/invariant';

import {
  type Child,
  useWorkspaceLoaderData,
} from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

const { isRequest } = models.request;
const { isRequestGroup } = models.requestGroup;

export const useRunnerRequestList = (organizationId: string, targetFolderId: string, runnerId: string) => {
  const { collection } = useWorkspaceLoaderData()!;
  const entityMapRef = useRef(new Map<string, Child>());

  const requestRows: RequestRow[] = useMemo(() => {
    return collection
      .filter(item => {
        entityMapRef.current.set(item.doc._id, item);
        return isRequest(item.doc);
      })
      .map((item: Child) => {
        const ancestors: { id: string; name: string }[] = [];
        if (item.ancestors) {
          item.ancestors.forEach(ancestorId => {
            const ancestor = entityMapRef.current.get(ancestorId);
            if (ancestor && isRequestGroup(ancestor?.doc)) {
              ancestors.push({ id: ancestor?.doc._id, name: ancestor?.doc.name });
            }
          });
        }

        const requestDoc = item.doc as Request;
        invariant('method' in item.doc, 'Only Request is supported at the moment');
        return {
          id: item.doc._id,
          name: item.doc.name,
          ancestors,
          method: requestDoc.method,
          url: item.doc.url,
          parentId: item.doc.parentId,
        };
      })
      .filter(item => {
        if (targetFolderId) {
          return item.ancestors.map(a => a.id).includes(targetFolderId);
        }
        return true;
      });
  }, [collection, targetFolderId]);

  const { runnerStateMap, runnerStateRef, updateRunnerState } = useRunnerContext();

  useEffect(() => {
    if (!runnerStateRef?.current?.[organizationId]?.[runnerId]) {
      updateRunnerState(organizationId, runnerId, {
        reqList: requestRows,
      });
    }
  }, [organizationId, requestRows, runnerId, runnerStateRef, updateRunnerState]);

  return {
    reqList: runnerStateMap[organizationId]?.[runnerId]?.reqList || [],
    requestRows,
    entityMap: entityMapRef.current,
  };
};
