import { type ActionFunctionArgs, href } from 'react-router';

import { userSession as sessionModel } from '~/models';
import { saveVaultKey, validateVaultKey } from '~/ui/vault-key.client';
import { createFetcherSubmitHook } from '~/utils/router';

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

export const useValidateVaultKeyActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ vaultKey, saveVaultKey = false }: { vaultKey: string; saveVaultKey?: boolean }) => {
      const url = href('/auth/validate-vault-key');

      return submit(JSON.stringify({ vaultKey, saveVaultKey }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
