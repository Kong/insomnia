import { getVault } from 'insomnia-api';
import { type ActionFunctionArgs, href } from 'react-router';

import { services } from '~/insomnia-data';
import { createFetcherSubmitHook } from '~/utils/router';

export async function clientAction(_args: ActionFunctionArgs) {
  try {
    const userSession = await services.userSession.getOrCreate();
    const { id: sessionId } = userSession;
    const { salt: vaultSalt } = await getVault({ sessionId });
    if (vaultSalt) {
      await services.userSession.update(userSession, { vaultSalt });
      return vaultSalt;
    }
  } catch (error) {
    console.error(`failed to get vault salt ${error.toString()}`);
  }
  return;
}

export const useUpdateVaultSaltFetcher = createFetcherSubmitHook(
  submit => () => {
    return submit({}, { action: href('/auth/update-vault-salt'), method: 'POST' });
  },
  clientAction,
);
