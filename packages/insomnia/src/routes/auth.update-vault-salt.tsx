import { type ActionFunctionArgs, href } from 'react-router';

import { userSession as sessionModel } from '~/models';
import { insomniaFetch } from '~/ui/insomnia-fetch';
import { createFetcherSubmitHook } from '~/utils/router';

export async function clientAction(_args: ActionFunctionArgs) {
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

export const useUpdateVaultSaltFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit({}, { action: href('/auth/update-vault-salt'), method: 'POST' });
  },
  clientAction,
);
