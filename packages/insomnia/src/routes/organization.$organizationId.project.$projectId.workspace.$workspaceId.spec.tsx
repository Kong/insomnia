import { href, redirect } from 'react-router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec';

// The spec route has been merged into the debug route.
// This route only exists to redirect old bookmarks/tabs/synced links to the merged page.
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId, workspaceId } = params;

  throw redirect(
    `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
      organizationId,
      projectId,
      workspaceId,
    })}`,
  );
}
