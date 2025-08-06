import { type ActionFunction } from 'react-router';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '../../common/constants';
import * as models from '../../models';
import type { BaseCloudCredential } from '../../models/cloud-credential';
import { executePluginMainAction } from '../../plugins';
import { invariant } from '../../utils/invariant';

export const createCloudCredentialAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  const { name, provider, credentials, isAuthenticated } = patch as BaseCloudCredential & { isAuthenticated?: boolean };
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
      error: error.errorMessage,
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
    return result;
  }
  return { error: 'Unexpected response from ' + provider };
};

export const updateCloudCredentialAction: ActionFunction = async ({ request, params }) => {
  const { cloudCredentialId } = params;
  invariant(typeof cloudCredentialId === 'string', 'Credential ID is required');
  const patch = await request.json();
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
      error: error.errorMessage,
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
    return result;
  }
  return { error: 'Unexpected response from ' + provider };
};

export const deleteCloudCredentialAction: ActionFunction = async ({ params }) => {
  const { cloudCredentialId } = params;
  invariant(typeof cloudCredentialId === 'string', 'Cloud Credential ID is required');
  const cloudCredential = await models.cloudCredential.getById(cloudCredentialId);
  invariant(cloudCredential, 'Cloud Credential not found');
  await models.cloudCredential.remove(cloudCredential);
  return null;
};
