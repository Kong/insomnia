import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import * as models from '~/models';
import type { BaseCloudCredential } from '~/models/cloud-credential';
import { executePluginMainAction } from '~/plugins';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/cloud-credentials.create';

type CreateCloudCredentialsData = BaseCloudCredential & { isAuthenticated?: boolean; provider: string };

export async function clientAction({ request }: Route.ClientActionArgs) {
  const patch = await request.json();
  const { name, provider, credentials, isAuthenticated } = patch as CreateCloudCredentialsData;
  invariant(name && typeof name === 'string', 'Name is required');
  invariant(provider, 'Cloud Provider name is required');
  invariant(credentials, 'Credentials are required');
  if (isAuthenticated) {
    // find credential with same name for oauth authenticated cloud service
    const existingCredential = await models.cloudCredential.getByName(name, provider);
    if (existingCredential.length === 0) {
      await models.cloudCredential.create(patch);
    } else {
      await models.cloudCredential.update(existingCredential[0], patch);
    }
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

export function useCreateCloudCredentialActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcher } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    function submit(data: CreateCloudCredentialsData) {
      return fetcherSubmit(JSON.stringify(data), {
        method: 'POST',
        action: href('/cloud-credentials/create'),
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
