import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { createVaultKey } from '~/ui/vault-key.client';

import type { Route } from './+types/auth.create-vault-key';

export async function clientAction(_args: Route.ClientActionArgs) {
  return createVaultKey('create');
}

export function useCreateVaultKeyFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(() => {
    fetcherSubmit({}, { action: href('/auth/create-vault-key'), method: 'POST' });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
