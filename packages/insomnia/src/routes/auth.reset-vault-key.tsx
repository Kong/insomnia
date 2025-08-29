import { useCallback } from 'react';
import { type ActionFunctionArgs, href, useFetcher } from 'react-router';

import { createVaultKey } from '~/ui/vault-key.client';

export async function clientAction(_args: ActionFunctionArgs) {
  return createVaultKey('reset');
}

export function useResetVaultKeyFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(() => {
    fetcherSubmit({}, { action: href('/auth/reset-vault-key'), method: 'POST' });
  }, [fetcherSubmit]);

  return {
    ...fetcherRest,
    submit,
  };
}
