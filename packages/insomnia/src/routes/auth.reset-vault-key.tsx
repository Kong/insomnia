import { type ActionFunctionArgs, href } from 'react-router';

import { createVaultKey } from '~/ui/vault-key.client';
import { addScopeField, createFetcherSubmitHook } from '~/utils/router';

export async function clientAction(_args: ActionFunctionArgs) {
  return createVaultKey('reset');
}

export const useResetVaultKeyFetcher = createFetcherSubmitHook(
  submit => () => {
    submit(addScopeField({ scopes: ['root'], data: {} }), { action: href('/auth/reset-vault-key'), method: 'POST' });
  },
  clientAction,
);
