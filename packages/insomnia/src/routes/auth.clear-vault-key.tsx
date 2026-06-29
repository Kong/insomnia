import { getVault } from 'insomnia-api';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { showToast } from '~/ui/components/toast-notification';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/auth.clear-vault-key';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { organizations = [], sessionId: resetVaultClientSessionId } = await request.json();

  const userSession = await services.userSession.get();
  const { id: sessionId } = userSession;
  const { salt: newVaultSalt } =
    (await getVault({ sessionId }).catch(error => {
      console.error(`failed to get vault salt ${error.toString()}`);
    })) || {};
  // User on other device has reset the vault key.
  if (resetVaultClientSessionId !== sessionId) {
    // remove all secret environment variables
    await services.environment.removeAllSecrets(organizations);
    // Update vault salt and delete vault key from session
    await services.userSession.update({ vaultSalt: newVaultSalt, vaultKey: '' });
    // show notification
    showToast({
      title: 'Your vault key has been reset, all your local secrets have been deleted.',
      status: 'info',
    });
    return true;
  }
  return false;
}

export const useClearVaultKeyFetcher = createFetcherSubmitHook(
  submit => (data: { organizations: string[]; sessionId: string }) => {
    submit(data, {
      action: href('/auth/clear-vault-key'),
      method: 'POST',
      encType: 'application/json',
    });
  },
  clientAction,
);
