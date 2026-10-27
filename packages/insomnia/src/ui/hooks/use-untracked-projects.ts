import type { Organization } from 'insomnia-api';
import { models } from 'insomnia-data';
import { useMemo } from 'react';

import { type UntrackedProjectsData, untrackedProjectsQuery } from '~/common/app-data';
import { useDBQuery } from '~/ui/hooks/use-query';

const emptyData: UntrackedProjectsData = { untrackedProjects: [], untrackedWorkspaces: [] };

/**
 * Projects that belong to none of the account's organizations, and workspaces that belong to no project.
 * Takes the organizations and account id from the caller rather than reading them from `~/root` /
 * `useOrganizations`, which would add import cycles through the settings modal.
 */
export function useUntrackedProjects(organizations: Organization[], accountId: string): UntrackedProjectsData {
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
