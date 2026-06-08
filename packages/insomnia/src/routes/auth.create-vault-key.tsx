import { href } from 'react-router';

import { createVaultKey } from '~/ui/vault-key.client';
import { addScopeField, createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/auth.create-vault-key';

export async function clientAction(_args: Route.ClientActionArgs) {
  return createVaultKey('create');
}

export const useCreateVaultKeyFetcher = createFetcherSubmitHook(
  submit => () => {
    submit(addScopeField({ scopes: ['root'], data: {} }), {
      action: href('/auth/create-vault-key'),
      method: 'POST',
    });
  },
  clientAction,
);
