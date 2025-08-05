import { useCallback } from 'react';
import { type ActionFunctionArgs, href, useFetcher } from 'react-router';

import { userSession as sessionModel } from '~/models';
import { saveVaultKey, validateVaultKey } from '~/ui/vault-key.client';

export async function clientAction({ request }: ActionFunctionArgs) {
  const { vaultKey, saveVaultKey: saveVaultKeyLocally = false } = await request.json();
  const userSession = await sessionModel.getOrCreate();
  const { vaultSalt, accountId } = userSession;

  if (!vaultSalt) {
    return { error: 'Please generate a vault key from preference first' };
  }

  try {
    const validateResult = await validateVaultKey(userSession, vaultKey, vaultSalt);
    if (!validateResult) {
      return { error: 'Invalid vault key, please check and input again' };
    }
    if (saveVaultKeyLocally) {
      await saveVaultKey(accountId, vaultKey);
    }
    return { vaultKey, srpK: validateResult };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    return { error: errorMessage };
  }
}

export function useValidateVaultKeyActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({ vaultKey, saveVaultKey = false }: { vaultKey: string; saveVaultKey?: boolean }) => {
      const url = href('/auth/validate-vault-key');

      return fetcherSubmit(JSON.stringify({ vaultKey, saveVaultKey }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
