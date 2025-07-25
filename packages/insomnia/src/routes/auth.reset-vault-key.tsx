import { type ActionFunctionArgs, href, useFetcher } from 'react-router';

import { createVaultKey } from '~/ui/vault-key.client';

export async function clientAction(_args: ActionFunctionArgs) {
  return createVaultKey('reset');
}

export function useResetVaultKeyFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit() {
    fetcher.submit({}, { action: href('/auth/reset-vault-key'), method: 'POST' });
  }

  return {
    ...fetcher,
    submit,
  };
}
