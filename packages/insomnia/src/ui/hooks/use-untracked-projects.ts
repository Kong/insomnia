import { models } from 'insomnia-data';
import { useMemo } from 'react';

import { type UntrackedProjectsData, untrackedProjectsQuery } from '~/common/app-data';
import { useRootLoaderData } from '~/root';
import { useOrganizations } from '~/ui/hooks/use-account-server-data';
import { useDBQuery } from '~/ui/hooks/use-query';

const emptyData: UntrackedProjectsData = { untrackedProjects: [], untrackedWorkspaces: [] };

/** Projects that belong to none of the account's organizations, and workspaces that belong to no project. */
export function useUntrackedProjects(): UntrackedProjectsData {
  const { userSession } = useRootLoaderData()!;
  const organizations = useOrganizations();
  const accountId = userSession.accountId;

  const trackedOrganizationIds = useMemo(
    () =>
      [
        ...new Set([
          ...organizations.map(organization => organization.id),
          models.organization.SCRATCHPAD_ORGANIZATION_ID,
          models.organization.getKonnectOrganizationId(accountId),
        ]),
      ].sort(),
    [organizations, accountId],
  );

  const { data } = useDBQuery(untrackedProjectsQuery(trackedOrganizationIds));
  return data ?? emptyData;
}
