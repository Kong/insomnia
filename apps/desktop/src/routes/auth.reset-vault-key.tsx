import { type ActionFunctionArgs, href } from 'react-router';

import { createFetcherSubmitHook } from '~/ui/utils/router';
import { createVaultKey } from '~/ui/vault-key.client';

export async function clientAction(_args: ActionFunctionArgs) {
  return createVaultKey('reset');
}

export const useResetVaultKeyFetcher = createFetcherSubmitHook(
  submit => () => {
    submit({}, { action: href('/auth/reset-vault-key'), method: 'POST' });
  },
  clientAction,
);
