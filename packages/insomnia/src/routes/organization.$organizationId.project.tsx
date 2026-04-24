import { createProjectActionHandler } from '~/domains/project';

const handleAction = createProjectActionHandler('/organization/:organizationId/project');

import type { Route } from './+types/organization.$organizationId.project';

export const clientAction = async ({ request }: Route.ClientActionArgs) => {
  return handleAction(request);
};
