import { services } from '~/insomnia-data';
import { fetchAndCacheOrganizationStorageRule as _syncStorageRule, syncOrganizations } from '~/ui/organization-utils';

import { createDomain } from './base';

async function sync() {
  const { id: sessionId, accountId } = await services.userSession.getOrCreate();

  if (sessionId) {
    await syncOrganizations(sessionId, accountId);
  }

  return null;
}

async function fetchAndCacheOrganizationStorageRule({
  organizationId,
  force,
}: {
  organizationId: string;
  force: boolean;
}) {
  // TODO: organization-utils should be moved to domain layer
  return _syncStorageRule(organizationId, force);
}

const actions = {
  sync,
  fetchAndCacheOrganizationStorageRule,
};

const [createOrgActionHandler, useOrgAction] = createDomain(actions);

export { createOrgActionHandler, useOrgAction };
