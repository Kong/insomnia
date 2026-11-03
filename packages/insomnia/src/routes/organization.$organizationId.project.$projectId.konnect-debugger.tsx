import { models, services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { ErrorBoundary } from '~/ui/components/error-boundary';
import { KonnectDebuggerPane } from '~/ui/components/panes/konnect-debugger-pane';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';

import type { Route } from './+types/organization.$organizationId.project.$projectId.konnect-debugger';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  const project = await services.project.getById(projectId);

  if (!project) {
    throw redirect(href('/organization/:organizationId', { organizationId }));
  }

  // Redirect to the project page if the project is not connected to a Konnect control plane or region.
  if (!models.project.isKonnectProject(project)) {
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }

  return { project };
}

const Component = ({ loaderData }: Route.ComponentProps) => {
  return (
    <ErrorBoundary showAlert>
      <div className="flex h-full w-full flex-col text-(--color-font)">
        <OrganizationTabList />
        <div className="theme--pane min-h-0 flex-1">
          <KonnectDebuggerPane project={loaderData.project} />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default Component;
