import { models, services } from 'insomnia-data';
import { useCallback } from 'react';
import { href, useNavigate, useParams } from 'react-router';
import { useLatest } from 'react-use';

import type { OpenVariableSource, VariableSourceMeta } from '~/common/templating/types';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';

/**
 * Opens the editor that owns a variable's source:
 * - folder environment → the folder pane with its Environment tab selected
 * - project environment → the environment workspace page with the env selected
 * - collection environment → the collection's environment page with the env selected
 *
 * Returns a stable callback so CodeMirror widgets can capture it at creation time.
 * Callers must live under the organization layout (where tab context and route
 * params exist); collection environments fall back to plain navigation because
 * buildResourceUrl maps a collection workspace to its debug tab, not its
 * environment page.
 */
export const useOpenVariableSource = () => {
  const navigate = useNavigate();
  const tabNavigate = useTabNavigate();
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const open = async (source: VariableSourceMeta) => {
    const { workspaceId, environmentId, requestGroupId } = source;
    if (!workspaceId) {
      return;
    }

    if (requestGroupId) {
      const [workspace, requestGroup] = await Promise.all([
        services.workspace.getById(workspaceId),
        services.requestGroup.getById(requestGroupId),
      ]);
      const project = workspace ? await services.project.getById(workspace.parentId) : null;

      if (workspace && requestGroup && project) {
        await tabNavigate(
          {
            organization: organizationId,
            project,
            workspace,
            item: requestGroup,
          },
          {
            withTab: true,
            shouldNavigate: true,
            // Land on the folder's Environment tab, where its env editor lives.
            searchParams: new URLSearchParams({ tab: 'environment' }),
          },
        );
        return;
      }
    }

    const environmentTabUrl = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment', {
      organizationId,
      projectId,
      workspaceId,
    });
    const searchParams = environmentId ? new URLSearchParams({ environmentId }) : undefined;

    const workspace = await services.workspace.getById(workspaceId);
    const project = workspace ? await services.project.getById(workspace.parentId) : null;

    // Project environments are environment workspaces — proper tab resources.
    if (workspace && project && models.workspace.isEnvironment(workspace)) {
      await tabNavigate(
        { organization: organizationId, project, workspace, item: workspace },
        { withTab: true, shouldNavigate: true, searchParams },
      );
      return;
    }

    // A collection workspace has no tab resource for its environment page
    // (buildResourceUrl maps it to the debug tab), so plain navigation is the
    // only way to land on it; the tab system creates a temporary tab for the route.
    navigate(searchParams ? `${environmentTabUrl}?${searchParams}` : environmentTabUrl);
  };

  // Keep a stable identity: CodeMirror widgets capture this callback when they are
  // created and never rebind it.
  const openRef = useLatest(open);
  return useCallback<OpenVariableSource>((source: VariableSourceMeta) => openRef.current(source), [openRef]);
};
