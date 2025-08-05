import { ipcRenderer } from 'electron';
import type { ActionFunctionArgs } from 'react-router';

import { userSession as sessionModel } from '../../models';
import { removeAllSecrets } from '../../models/environment';
import type { ToastNotification } from '../components/toast';
import { insomniaFetch } from '../insomniaFetch';

export async function action({ request }: ActionFunctionArgs) {
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
    ipcRenderer.emit('show-notification', null, notification);
    return true;
  }
  return false;
}
