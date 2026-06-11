import { useQuery } from '@tanstack/react-query';
import { type CloudProviderCredential, services } from 'insomnia-data';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import { plugins } from '~/plugins/renderer-bridge';
import { invariant } from '~/utils/invariant';

import { queryKeys } from './query-keys';
import { useInvalidatingMutation } from './use-invalidating-mutation';

type CreateCloudCredentialData = Pick<CloudProviderCredential, 'name' | 'provider' | 'credentials'> & {
  isAuthenticated?: boolean;
  provider: string;
};

export const useCloudCredentials = () => {
  const { data } = useQuery({
    queryKey: queryKeys.cloudCredentials(),
    queryFn: () => services.cloudCredential.all(),
    initialData: [],
  });
  return data;
};

export const useCreateCloudCredential = () =>
  useInvalidatingMutation({
    mutationFn: async (patch: CreateCloudCredentialData) => {
      const { name, provider, credentials, isAuthenticated } = patch;
      invariant(name && typeof name === 'string', 'Name is required');
      invariant(provider, 'Cloud Provider name is required');
      invariant(credentials, 'Credentials are required');

      if (isAuthenticated) {
        // find credential with same name for oauth authenticated cloud service
        const existingCredential = await services.cloudCredential.getByName(name, provider);
        await (existingCredential.length === 0
          ? services.cloudCredential.create(patch as Partial<CloudProviderCredential>)
          : services.cloudCredential.update(existingCredential[0], patch as Partial<CloudProviderCredential>));
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
          const credentialsRecord = patch.credentials as unknown as Record<string, unknown>;
          credentialsRecord['access_token'] = access_token;
          credentialsRecord['expires_at'] = expires_at;
        }
        await services.cloudCredential.create(patch as Partial<CloudProviderCredential>);
        return result as { access_token: string; expires_at: number };
      }
      return { error: 'Unexpected response from ' + provider };
    },
    invalidates: [queryKeys.cloudCredentials()],
  });

export const useUpdateCloudCredential = () =>
  useInvalidatingMutation({
    mutationFn: async ({
      cloudCredentialId,
      patch,
    }: {
      cloudCredentialId: string;
      patch: Partial<CloudProviderCredential>;
    }) => {
      const { name, provider, credentials } = patch;
      invariant(name && typeof name === 'string', 'Name is required');
      invariant(provider, 'Cloud Provider name is required');
      invariant(credentials, 'Credentials are required');

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
    },
    invalidates: [queryKeys.cloudCredentials()],
  });

export const useDeleteCloudCredential = () =>
  useInvalidatingMutation({
    mutationFn: async (cloudCredentialId: string) => {
      invariant(typeof cloudCredentialId === 'string', 'Cloud Credential ID is required');
      const cloudCredential = await services.cloudCredential.getById(cloudCredentialId);
      invariant(cloudCredential, 'Cloud Credential not found');
      await services.cloudCredential.remove(cloudCredential);
      return { name: cloudCredential.name, provider: cloudCredential.provider };
    },
    invalidates: [queryKeys.cloudCredentials()],
  });
