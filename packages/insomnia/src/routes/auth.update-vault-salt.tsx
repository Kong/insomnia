import { useCallback } from 'react';
import { type ActionFunctionArgs, href, useFetcher } from 'react-router';

import { userSession as sessionModel } from '~/models';
import { insomniaFetch } from '~/ui/insomniaFetch';

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

export function useUpdateVaultSaltFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(() => {
    return fetcherSubmit({}, { action: href('/auth/update-vault-salt'), method: 'POST' });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
