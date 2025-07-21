import { type ActionFunction, type LoaderFunction, redirect } from 'react-router';

import { FEATURE_NAME_EXTERNAL_VAULT, getBundlePluginByFeature } from '../../common/constants';
import * as models from '../../models';
import type { BaseCloudCredential } from '../../models/cloud-credential';
import { executePluginRouterAction } from '../../plugins';
import { invariant } from '../../utils/invariant';

export const createCloudCredentialAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  const { name, provider, credentials, isAuthenticated } = patch as BaseCloudCredential & { isAuthenticated?: boolean };
  invariant(typeof name === 'string', 'Name is required');
  invariant(provider, 'Cloud Provider name is required');
  if (name && provider && credentials) {
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
    const authenticateResponse = await executePluginRouterAction({
      pluginName: getBundlePluginByFeature(FEATURE_NAME_EXTERNAL_VAULT)?.name || '',
      actionName: 'authenticate',
      params: { provider, credentials },
    });
    const { success, error, result } = authenticateResponse!;
    if (success) {
      if (provider === 'hashicorp') {
        // update access token and expires_at
        const { access_token, expires_at } = result as { access_token: string; expires_at: number };
        patch.credentials['access_token'] = access_token;
        patch.credentials['expires_at'] = expires_at;
      }
      await models.cloudCredential.create(patch);
    } else {
      return {
        error: error?.errorMessage,
      };
    }
    return result;
  }
  return { error: 'Invalid parameters for creating cloud credential' };
};

export const updateCloudCredentialAction: ActionFunction = async ({ request, params }) => {
  const { cloudCredentialId } = params;
  invariant(typeof cloudCredentialId === 'string', 'Credential ID is required');
  const patch = await request.json();
  const { name, provider, credentials } = patch;
  invariant(typeof name === 'string', 'Name is required');
  invariant(provider, 'Cloud Provider name is required');
  if (name && provider && credentials) {
    const authenticateResponse = await executePluginRouterAction({
      pluginName: getBundlePluginByFeature(FEATURE_NAME_EXTERNAL_VAULT)?.name || '',
      actionName: 'authenticate',
      params: { provider, credentials },
    });
    const { success, error, result } = authenticateResponse!;
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
    } else {
      return {
        error: error?.errorMessage,
      };
    }
    return result;
  }
  return { error: 'Invalid parameters for updating cloud credential' };
};

export const deleteCloudCredentialAction: ActionFunction = async ({ params }) => {
  const { cloudCredentialId } = params;
  invariant(typeof cloudCredentialId === 'string', 'Cloud Credential ID is required');
  const cloudCredential = await models.cloudCredential.getById(cloudCredentialId);
  invariant(cloudCredential, 'Cloud Credential not found');
  await models.cloudCredential.remove(cloudCredential);
  return null;
};
