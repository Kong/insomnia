import type { ActionFunctionArgs } from 'react-router';

import { userSession } from '../../models';
import { syncOrganizations } from '../organization-utils';

export async function action(_args: ActionFunctionArgs) {
  const { id: sessionId, accountId } = await userSession.getOrCreate();

  if (sessionId) {
    await syncOrganizations(sessionId, accountId);
  }

  return null;
}
