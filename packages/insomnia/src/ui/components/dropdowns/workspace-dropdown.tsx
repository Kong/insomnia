import type { FC } from 'react';

import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

export const WorkspaceDropdown: FC = () => {
  const { activeWorkspace } = useWorkspaceLoaderData()!;

  return (
    <div
      aria-label="Workspace name"
      data-testid="workspace-context-dropdown"
      className="flex h-7 flex-1 items-center justify-center gap-2 truncate rounded-xs px-3 py-1 text-sm text-(--color-font)"
    >
      <span className="truncate" title={activeWorkspace.name}>
        {activeWorkspace.name}
      </span>
    </div>
  );
};
