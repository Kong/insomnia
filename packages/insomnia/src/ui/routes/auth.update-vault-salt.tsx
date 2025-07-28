import type { ActionFunctionArgs } from 'react-router';

import { userSession as sessionModel } from '../../models';
import { insomniaFetch } from '../insomniaFetch';

export async function action(_args: ActionFunctionArgs) {
  const userSession = await sessionModel.getOrCreate();
  const { id: sessionId } = userSession;
  const { salt: vaultSalt } = await insomniaFetch<{
    salt?: string;
    error?: string;
  }>({
    method: 'GET',
    path: '/v1/user/vault',
    sessionId,
  });
  if (vaultSalt) {
    await sessionModel.update(userSession, { vaultSalt });
  }
  return vaultSalt;
}
