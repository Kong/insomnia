import type { CollectionWorkspaceChildren } from 'insomnia-data';
import { services } from 'insomnia-data';
import { workspaceChildrenKeys } from 'insomnia-data/common';
import { useEffect, useMemo, useState } from 'react';

export function useCollectionWorkspaceChildren(
  collectionWorkspaceIds: string[],
): Map<string, CollectionWorkspaceChildren> {
  const [collectionChildrenById, setCollectionChildrenById] = useState<Map<string, CollectionWorkspaceChildren>>(
    () => new Map(),
  );

  const collectionWorkspaceIdsKey = useMemo(
    () => [...collectionWorkspaceIds].sort().join(','),
    [collectionWorkspaceIds],
  );

  useEffect(() => {
    if (!collectionWorkspaceIdsKey) {
      setCollectionChildrenById(new Map());
      return;
    }
    let cancelled = false;
    services.appData.getWorkspaceChildren(collectionWorkspaceIdsKey.split(','), 'collection').then(result => {
      if (!cancelled) {
        setCollectionChildrenById(previous => new Map([...previous, ...result]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [collectionWorkspaceIdsKey]);

  useEffect(() => {
    const [workspaceChildrenKeyPrefix] = workspaceChildrenKeys.all;
    return window.main.on('app-data-cache.update', (_, queryKey: string[], data: CollectionWorkspaceChildren) => {
      if (queryKey[0] !== workspaceChildrenKeyPrefix) {
        return;
      }
      const workspaceId = queryKey[1] as string;
      setCollectionChildrenById(previous => {
        if (!previous.has(workspaceId)) {
          return previous;
        }
        const newCollectionChildrenById = new Map(previous);
        newCollectionChildrenById.set(workspaceId, data);
        return newCollectionChildrenById;
      });
    });
  }, []);

  return collectionChildrenById;
}
