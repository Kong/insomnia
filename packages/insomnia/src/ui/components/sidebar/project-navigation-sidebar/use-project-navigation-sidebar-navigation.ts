import type { Virtualizer } from '@tanstack/react-virtual';
import { database, models, type Workspace } from 'insomnia-data';
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
  toggleRequestGroups,
  toggleRequest,
  expandProjectOrWorkspaces,
  visibleFlatItems,
  virtualizer,
}: {
  toggleRequestGroups: (requestGroupIds: string[], workspace: Workspace, collapsed?: boolean) => Promise<void>;
  // Expands a request's examples section (its children in the sidebar).
  toggleRequest: (requestId: string, workspace: Workspace, collapsed?: boolean) => Promise<void>;
  expandProjectOrWorkspaces: (ids: string[]) => void;
  visibleFlatItems: FlatItem[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}) => {
  const { scrollToIndex } = virtualizer;
  const { routeInfo, getNavigationResources } = useInsomniaNavigation();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const lastHandledScrollKeyRef = useRef<string | null>(null);

  const toggleRequestGroupsRef = useRef(toggleRequestGroups);
  const toggleRequestRef = useRef(toggleRequest);
  const expandProjectOrWorkspacesRef = useRef(expandProjectOrWorkspaces);
  toggleRequestGroupsRef.current = toggleRequestGroups;
  toggleRequestRef.current = toggleRequest;
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
        // Include Request in the walk: an example's parent is a request, and a
        // chain that stops there would expand no folder at all.
        const requestGroups = (
          await database.withAncestors(resources.resource, [models.request.type, models.requestGroup.type])
        )
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

        // A request's examples are its children: open that section too, or the
        // selected example row stays hidden inside a collapsed request.
        if (models.example.isExample(resources.resource)) {
          await toggleRequestRef.current(resources.resource.parentId, resources.workspace, false);
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
