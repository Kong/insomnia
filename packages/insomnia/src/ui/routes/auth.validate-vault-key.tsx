import type { ActionFunctionArgs } from 'react-router';

import { userSession as sessionModel } from '../../models';
import { saveVaultKey, validateVaultKey } from '../vault-key';

export async function action({ request }: ActionFunctionArgs) {
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
    return { error: error.toString() };
  }
}
