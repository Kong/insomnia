import { href } from 'react-router';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import * as models from '~/models';
import type { CloudProviderCredential } from '~/models/cloud-credential';
import { executePluginMainAction } from '~/plugins';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

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
    const existingCredential = await models.cloudCredential.getByName(name, provider);
    await (existingCredential.length === 0
      ? models.cloudCredential.create(patch)
      : models.cloudCredential.update(existingCredential[0], patch));
    return credentials;
  }
  const authenticateResponse = await executePluginMainAction({
    pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
    actionName: 'authenticate',
    params: { provider, credentials },
  });
  const { success, error, result } = authenticateResponse!;
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
    await models.cloudCredential.create(patch);
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
