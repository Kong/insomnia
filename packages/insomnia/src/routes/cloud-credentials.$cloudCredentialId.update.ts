import { href } from 'react-router';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import type { CloudProviderCredential } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { executePluginMainAction } from '~/plugins';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

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
    const originCredential = await services.cloudCredential.getById(cloudCredentialId);
    invariant(originCredential, 'No Cloud Credential found');
    if (provider === 'hashicorp') {
      // update access token and expires_at
      const { access_token, expires_at } = result as { access_token: string; expires_at: number };
      if (patch.credentials) {
        patch.credentials['access_token'] = access_token;
        patch.credentials['expires_at'] = expires_at;
      }
    }
    await services.cloudCredential.update(originCredential, patch);
    return result as { access_token: string; expires_at: number };
  }
  return { error: 'Unexpected response from ' + provider };
}

export const useUpdateCloudCredentialActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ cloudCredentialId, patch }: { cloudCredentialId: string; patch: Partial<CloudProviderCredential> }) => {
      return submit(JSON.stringify(patch), {
        method: 'POST',
        action: href('/cloud-credentials/:cloudCredentialId/update', {
          cloudCredentialId,
        }),
        encType: 'application/json',
      });
    },
  clientAction,
);
