import type { Virtualizer } from '@tanstack/react-virtual';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';

import { database, models } from '~/insomnia-data';
import type { NavigationResources } from '~/ui/hooks/use-insomnia-navigation';
import { useInsomniaNavigation } from '~/ui/hooks/use-insomnia-navigation';

import type { FlatItem } from './types';

const getSelectedItemId = (resources?: NavigationResources) => {
  if (!resources?.project) {
    return null;
  }

  if (!resources.workspace) {
    return resources.project._id;
  }

  if (!models.workspace.isCollection(resources.workspace)) {
    return resources.workspace._id;
  }

  return resources.resource?._id || null;
};

export const useProjectNavigationSidebarNavigation = ({
  setExpandedProjectAndWorkspaceIds,
  toggleRequestGroups,
  visibleFlatItems,
  virtualizer,
}: {
  setExpandedProjectAndWorkspaceIds: Dispatch<SetStateAction<string[] | undefined>>;
  toggleRequestGroups: (requestGroupIds: string[], collapsed?: boolean) => Promise<void>;
  visibleFlatItems: FlatItem[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) => {
  const { scrollToIndex } = virtualizer;
  const { routeInfo, getNavigationResources } = useInsomniaNavigation();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const navigationKey = routeInfo ? `${routeInfo.routeId}:${routeInfo.resourceId}` : 'unknown-route';
  const lastHandledNavigationKeyRef = useRef<string | null>(null);
  const lastHandledScrollKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!routeInfo) {
      lastHandledNavigationKeyRef.current = null;
      setSelectedItemId(null);
      return;
    }

    if (lastHandledNavigationKeyRef.current === navigationKey) {
      return;
    }

    lastHandledNavigationKeyRef.current = navigationKey;

    getNavigationResources().then(async resources => {
      if (cancelled) {
        return;
      }

      const nextSelectedItemId = getSelectedItemId(resources);
      setSelectedItemId(nextSelectedItemId);

      if (!resources?.project || !nextSelectedItemId) {
        return;
      }

      const idsToExpand = [resources.project._id];
      if (resources.workspace && models.workspace.isCollection(resources.workspace)) {
        idsToExpand.push(resources.workspace._id);
      }

      if (
        resources.resource &&
        resources.workspace &&
        !models.workspace.isWorkspace(resources.resource) &&
        models.workspace.isCollection(resources.workspace)
      ) {
        const requestGroupIds = (await database.withAncestors(resources.resource))
          .reverse()
          .filter(models.requestGroup.isRequestGroup)
          .map(requestGroup => requestGroup._id);

        if (cancelled) {
          return;
        }

        idsToExpand.push(...requestGroupIds);

        if (requestGroupIds.length > 0) {
          await toggleRequestGroups(requestGroupIds, false);
        }
      }

      setExpandedProjectAndWorkspaceIds(previousExpandedIds => {
        const expandedIds = previousExpandedIds || [];
        const missingIds = idsToExpand.filter(id => !expandedIds.includes(id));

        return missingIds.length > 0 ? [...expandedIds, ...missingIds] : expandedIds;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [getNavigationResources, navigationKey, routeInfo, setExpandedProjectAndWorkspaceIds, toggleRequestGroups]);

  useEffect(() => {
    if (!selectedItemId) {
      lastHandledScrollKeyRef.current = null;
      return;
    }

    if (lastHandledScrollKeyRef.current === selectedItemId) {
      return;
    }

    const targetIndex = visibleFlatItems.findIndex(item => item.doc._id === selectedItemId);
    if (targetIndex !== -1) {
      scrollToIndex(targetIndex, { align: 'auto' });
      lastHandledScrollKeyRef.current = selectedItemId;
    }
  }, [scrollToIndex, selectedItemId, visibleFlatItems]);

  return {
    selectedItemId,
    routeInfo,
  };
};
