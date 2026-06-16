import type { CloudProviderCredential } from 'insomnia-data';
import { services } from 'insomnia-data';
import { href } from 'react-router';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import { invariant } from '~/common/utils/invariant';
import { plugins } from '~/ui/plugins/renderer-bridge';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/cloud-credentials.create';

type CreateCloudCredentialsData = Pick<CloudProviderCredential, 'name' | 'provider' | 'credentials'> & {
  isAuthenticated?: boolean;
  provider: string;
};

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  const { name, provider, credentials, isAuthenticated } = patch as CreateCloudCredentialsData;
  invariant(name && typeof name === 'string', 'Name is required');
  invariant(provider, 'Cloud Provider name is required');
  invariant(credentials, 'Credentials are required');
  if (isAuthenticated) {
    // find credential with same name for oauth authenticated cloud service
    const existingCredential = await services.cloudCredential.getByName(name, provider);
    await (existingCredential.length === 0
      ? services.cloudCredential.create(patch)
      : services.cloudCredential.update(existingCredential[0], patch));
    return credentials;
  }
  const authenticateResponse = await plugins.executePluginMainAction({
    pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
    actionName: 'authenticate',
    params: { provider, credentials },
  });
  const { success, error, result } = authenticateResponse as any;
  if (error) {
    return {
      error: `${error.errorMessage}`,
    };
  }
  if (success) {
    if (provider === 'hashicorp') {
      // update access token and expires_at
      const { access_token, expires_at } = result as { access_token: string; expires_at: number };
      patch.credentials['access_token'] = access_token;
      patch.credentials['expires_at'] = expires_at;
    }
    await services.cloudCredential.create(patch);
    return result as { access_token: string; expires_at: number };
  }
  return { error: 'Unexpected response from ' + provider };
}

export const useCreateCloudCredentialActionFetcher = createFetcherSubmitHook(
  submit => (data: CreateCloudCredentialsData) => {
    return submit(JSON.stringify(data), {
      method: 'POST',
      action: href('/cloud-credentials/create'),
      encType: 'application/json',
    });
  },
  clientAction,
);
