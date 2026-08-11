import type { OrganizationData } from 'insomnia-data';
import { services } from 'insomnia-data';

import { organizationDataKeys } from '~/common/app-data';
import { useDBQuery } from '~/ui/hooks/use-query';

// Renderer hooks that mapping to the @insomnia-data/node-src/services/app-data/organization-data functions.
// The hooks is used to fetch data from the main process and cache it in the renderer process for future use.
export function useOrganizationData(organizationId: string): OrganizationData {
  const { data } = useDBQuery({
    queryKey: organizationDataKeys.byOrganizationId(organizationId),
    queryFn: () => services.appData.getOrganizationData(organizationId),
  });
  const emptyData: OrganizationData = {
    projects: [],
    workspaces: [],
    workspaceMetas: [],
  };

  return data ?? emptyData;
}
