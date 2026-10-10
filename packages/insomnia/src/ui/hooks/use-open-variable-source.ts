import { models, services } from 'insomnia-data';
import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useLatest } from 'react-use';

import type { OpenVariableSource, VariableSourceMeta } from '~/common/templating/types';
import uiEventBus, { OPEN_ENVIRONMENTS_MODAL } from '~/ui/event-bus';

import { buildResourceUrl } from './use-insomnia-navigation';

/**
 * Opens the editor that owns a variable's source:
 * - folder environment → the folder pane with its Environment tab selected
 * - project environment → the environment workspace page with the env selected
 * - collection environment → the workspace environments modal (the picker's
 *   manage dialog), opened in place via the workspace pane header
 *
 * Returns a stable callback so CodeMirror widgets can capture it at creation time.
 * Callers must live under the organization route (where route params exist).
 *
 * URLs come from the navigation registry (buildResourceUrl) and navigation is
 * plain: this hook is reachable from root-mounted modals (CodePromptModal →
 * MarkdownEditor → CodeEditor), so it must not statically import the tab system —
 * that edge closes a circular reference back to root.tsx. The tab-list route sync
 * (useInsomniaTab) activates the matching tab or creates a temporary one for the
 * landed URL. The collection modal is likewise reached through the event bus: the
 * modal embeds the same editors that consume this hook, so a static import would
 * close a cycle.
 */
export const useOpenVariableSource = () => {
  const navigate = useNavigate();
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const open = async (source: VariableSourceMeta) => {
    const { workspaceId, environmentId, requestGroupId } = source;
    // Editors can mount outside the organization route (e.g. CodePromptModal); without
    // route params the URLs below cannot be built.
    if (!workspaceId || !organizationId || !projectId) {
      return;
    }

    if (requestGroupId) {
      const requestGroup = await services.requestGroup.getById(requestGroupId);

      if (requestGroup) {
        // Land on the folder's Environment tab, where its env editor lives.
        navigate(
          buildResourceUrl({
            organizationId,
            projectId,
            workspaceId,
            resource: requestGroup,
            searchParams: new URLSearchParams({ tab: 'environment' }),
          }),
        );
        return;
      }
    }

    const workspace = await services.workspace.getById(workspaceId);
    if (!workspace) {
      return;
    }

    // Project environments are environment workspaces — navigate to their page,
    // which is the workspace's home route.
    if (models.workspace.isEnvironment(workspace)) {
      navigate(
        buildResourceUrl({
          organizationId,
          projectId,
          workspaceId,
          resource: workspace,
          searchParams: environmentId ? new URLSearchParams({ environmentId }) : undefined,
        }),
      );
      return;
    }

    // A collection environment has no page of its own; open the workspace's
    // environments modal in place. A render context only contains the current
    // workspace's collection environments, so the pane header's modal (bound to
    // the current route's workspace) always holds the requested environment.
    uiEventBus.emit(OPEN_ENVIRONMENTS_MODAL, environmentId ?? '');
  };

  // Keep a stable identity: CodeMirror widgets capture this callback when they are
  // created and never rebind it.
  const openRef = useLatest(open);
  return useCallback<OpenVariableSource>((source: VariableSourceMeta) => openRef.current(source), [openRef]);
};
