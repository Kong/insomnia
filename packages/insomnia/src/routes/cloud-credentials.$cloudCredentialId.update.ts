import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import * as models from '~/models';
import type { CloudProviderCredential } from '~/models/cloud-credential';
import { executePluginMainAction } from '~/plugins';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/cloud-credentials.$cloudCredentialId.update';

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const { cloudCredentialId } = params;
  invariant(typeof cloudCredentialId === 'string', 'Credential ID is required');
  const patch = (await request.json()) as CloudProviderCredential;
  const { name, provider, credentials } = patch;
  invariant(name && typeof name === 'string', 'Name is required');
  invariant(provider, 'Cloud Provider name is required');
  invariant(credentials, 'Credentials are required');
  const authenticateResponse = await executePluginMainAction({
    pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
    actionName: 'authenticate',
    params: { provider, credentials },
  });
  const { success, error, result } = authenticateResponse;
  if (error) {
    return {
      error: `${error.errorMessage}`,
    };
  }
  if (success) {
    const originCredential = await models.cloudCredential.getById(cloudCredentialId);
    invariant(originCredential, 'No Cloud Credential found');
    if (provider === 'hashicorp') {
      // update access token and expires_at
      const { access_token, expires_at } = result as { access_token: string; expires_at: number };
      patch.credentials['access_token'] = access_token;
      patch.credentials['expires_at'] = expires_at;
    }
    await models.cloudCredential.update(originCredential, patch);
    return result as { access_token: string; expires_at: number };
  }
  return { error: 'Unexpected response from ' + provider };
}

export function useUpdateCloudCredentialActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcher } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    function submit({
      cloudCredentialId,
      patch,
    }: {
      cloudCredentialId: string;
      patch: Partial<CloudProviderCredential>;
    }) {
      return fetcherSubmit(JSON.stringify(patch), {
        method: 'POST',
        action: href('/cloud-credentials/:cloudCredentialId/update', {
          cloudCredentialId,
        }),
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcher,
    submit,
  };
}
