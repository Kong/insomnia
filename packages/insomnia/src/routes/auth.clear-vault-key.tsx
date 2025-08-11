import electron from 'electron';
import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { userSession as sessionModel } from '~/models';
import { removeAllSecrets } from '~/models/environment';
import type { ToastNotification } from '~/ui/components/toast';
import { insomniaFetch } from '~/ui/insomniaFetch';

import type { Route } from './+types/auth.clear-vault-key';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const { organizations = [], sessionId: resetVaultClientSessionId } = await request.json();

  const userSession = await sessionModel.getOrCreate();
  const { id: sessionId } = userSession;
  const { salt: newVaultSalt } =
    (await insomniaFetch<{
      salt?: string;
      error?: string;
    }>({
      method: 'GET',
      path: '/v1/user/vault',
      sessionId,
    }).catch(error => {
      console.error(`failed to get vault salt ${error.toString()}`);
    })) || {};
  // User on other device has reset the vault key.
  if (resetVaultClientSessionId !== sessionId) {
    // remove all secret environment variables
    await removeAllSecrets(organizations);
    // Update vault salt and delete vault key from session
    sessionModel.update(userSession, { vaultSalt: newVaultSalt, vaultKey: '' });
    // show notification
    const notification: ToastNotification = {
      key: 'Vault key reset',
      message: 'Your vault key has been reset, all you local secrets have been deleted.',
    };
    electron.ipcRenderer.emit('show-notification', null, notification);
    return true;
  }
  return false;
}

export function useClearVaultKeyFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    (data: { organizations: string[]; sessionId: string }) => {
      fetcherSubmit(data, {
        action: href('/auth/clear-vault-key'),
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
