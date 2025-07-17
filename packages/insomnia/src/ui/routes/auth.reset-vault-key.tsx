import type { ActionFunctionArgs } from 'react-router';

import { createVaultKey } from '../vault-key';

export async function action(_args: ActionFunctionArgs) {
  return createVaultKey('reset');
}
