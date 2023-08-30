import { LoaderFunction, ShouldRevalidateFunction, useRouteLoaderData } from 'react-router-dom';

import { isLoggedIn } from '../../account/session';
import { database } from '../../common/database';
import { project } from '../../models';
import { defaultOrganization, Organization } from '../../models/organization';
import { isRemoteProject } from '../../models/project';
import { initializeProjectFromTeam } from '../../sync/vcs/initialize-model-from';
import { getVCS } from '../../sync/vcs/vcs';

export interface LoaderData {
  organizations: Organization[];
}

export const loader: LoaderFunction = async () => {
  try {
    const vcs = getVCS();
    if (vcs && isLoggedIn()) {
      const teams = await vcs.teams();
      const projects = await Promise.all(teams.map(initializeProjectFromTeam));
      await database.batchModifyDocs({ upsert: projects });
    }
  } catch {
    console.log('Failed to load projects');
  }
  const allProjects = await project.all();

  const remoteOrgs = allProjects
    .filter(isRemoteProject)
    .map(({ _id, name }) => ({
      _id,
      name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    organizations: [defaultOrganization, ...remoteOrgs],
  };
};

export const useOrganizationLoaderData = () => {
  return useRouteLoaderData('/organization') as LoaderData;
};

export const shouldOrganizationsRevalidate: ShouldRevalidateFunction = ({
  currentParams,
  nextParams,
  nextUrl,
}) => {
  const isSwitchingBetweenOrganizations = currentParams.organizationId !== nextParams.organizationId;
  // We need this for isLoggedIn to update the organization list
  // The hash gets removed from the URL after the first time it's used so it doesn't revalidate on every navigation
  const shouldForceRevalidate = nextUrl.hash === '#revalidate=true';

  return isSwitchingBetweenOrganizations || shouldForceRevalidate;
};
