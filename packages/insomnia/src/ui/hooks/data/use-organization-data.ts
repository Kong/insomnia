import type { OrganizationData } from 'insomnia-data';
import { services } from 'insomnia-data';
import { organizationDataKeys } from 'insomnia-data/common';
import { useEffect, useState } from 'react';

export type { OrganizationData, ProjectWithGitRepository } from 'insomnia-data';

const EMPTY_ORGANIZATION_DATA: OrganizationData = {
  projects: [],
  workspaces: [],
  workspaceMetas: [],
};

export function useOrganizationData(organizationId: string): OrganizationData {
  const [data, setData] = useState<OrganizationData>(EMPTY_ORGANIZATION_DATA);

  useEffect(() => {
    let cancelled = false;
    setData(EMPTY_ORGANIZATION_DATA);
    services.appData.getOrganizationData(organizationId).then(result => {
      if (!cancelled) {
        setData(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    const [organizationDataKeyPrefix] = organizationDataKeys.all;
    return window.main.on('app-data-cache.update', (_, queryKey: string[], updatedData: OrganizationData) => {
      if (queryKey[0] === organizationDataKeyPrefix && queryKey[1] === organizationId) {
        setData(updatedData as OrganizationData);
      }
    });
  }, [organizationId]);

  return data;
}
