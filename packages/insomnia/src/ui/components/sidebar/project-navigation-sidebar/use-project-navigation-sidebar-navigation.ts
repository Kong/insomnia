import type { Virtualizer } from '@tanstack/react-virtual';
import { database, models, type Workspace } from 'insomnia-data';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';

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
  setActiveTab,
  toggleRequestGroups,
  expandProjectOrWorkspaces,
  visibleFlatItems,
  virtualizer,
}: {
  setActiveTab: Dispatch<SetStateAction<'projects' | 'konnect' | undefined>>;
  toggleRequestGroups: (requestGroupIds: string[], workspace: Workspace, collapsed?: boolean) => Promise<void>;
  expandProjectOrWorkspaces: (ids: string[]) => void;
  visibleFlatItems: FlatItem[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) => {
  const { scrollToIndex } = virtualizer;
  const { routeInfo, getNavigationResources } = useInsomniaNavigation();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const lastHandledScrollKeyRef = useRef<string | null>(null);

  const setActiveTabRef = useRef(setActiveTab);
  const toggleRequestGroupsRef = useRef(toggleRequestGroups);
  const expandProjectOrWorkspacesRef = useRef(expandProjectOrWorkspaces);
  setActiveTabRef.current = setActiveTab;
  toggleRequestGroupsRef.current = toggleRequestGroups;
  expandProjectOrWorkspacesRef.current = expandProjectOrWorkspaces;

  useEffect(() => {
    let cancelled = false;

    if (!routeInfo) {
      setSelectedItemId(null);
      return;
    }

    getNavigationResources().then(async resources => {
      if (cancelled) {
        return;
      }

      const nextSelectedItemId = getSelectedItemId(resources);
      setSelectedItemId(nextSelectedItemId);

      if (!resources?.project || !nextSelectedItemId) {
        return;
      }

      // update active tab
      setActiveTabRef.current(resources.project.konnectControlPlaneId != null ? 'konnect' : 'projects');

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
        const requestGroups = (await database.withAncestors(resources.resource, [models.requestGroup.type]))
          .reverse()
          .filter(models.requestGroup.isRequestGroup);
        const requestGroupIds = requestGroups.map(requestGroup => requestGroup._id);

        if (cancelled) {
          return;
        }

        idsToExpand.push(...requestGroupIds);

        if (requestGroupIds.length > 0) {
          await toggleRequestGroupsRef.current(requestGroupIds, resources.workspace, false);
        }
      }

      expandProjectOrWorkspacesRef.current([...idsToExpand]);
    });

    return () => {
      cancelled = true;
    };
  }, [getNavigationResources, routeInfo]);

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
