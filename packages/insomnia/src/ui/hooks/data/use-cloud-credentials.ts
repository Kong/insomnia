import { type CloudProviderCredential, services } from 'insomnia-data';

import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import { invariant } from '~/common/utils/invariant';
import { useInvalidatingDBMutation } from '~/ui/hooks/use-mutations';
import { useDBQuery } from '~/ui/hooks/use-query';
import { plugins } from '~/ui/plugins/renderer-bridge';

type CreateCloudCredentialData = Pick<CloudProviderCredential, 'name' | 'provider' | 'credentials'> & {
  isAuthenticated?: boolean;
  provider: string;
};

const queryKeys = {
  cloudCredentials: () => ['cloudCredentials'],
};

const EMPTY_CLOUD_CREDENTIALS: CloudProviderCredential[] = [];

export const useCloudCredentials = (): CloudProviderCredential[] => {
  const { data } = useDBQuery({
    queryKey: queryKeys.cloudCredentials(),
    queryFn: () => services.cloudCredential.all(),
    // Credentials are also written outside these hooks (logout, plugins) and aren't pushed through db.changes,
    // Re-read on every mount instead of trusting the DB client's staleTime: Infinity default.
    staleTime: 0,
  });
  return data ?? EMPTY_CLOUD_CREDENTIALS;
};

export const useCreateCloudCredential = () =>
  useInvalidatingDBMutation({
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
  useInvalidatingDBMutation({
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
  useInvalidatingDBMutation({
    mutationFn: async (cloudCredentialId: string) => {
      invariant(typeof cloudCredentialId === 'string', 'Cloud Credential ID is required');
      const cloudCredential = await services.cloudCredential.getById(cloudCredentialId);
      invariant(cloudCredential, 'Cloud Credential not found');
      await services.cloudCredential.remove(cloudCredential);
      return { name: cloudCredential.name, provider: cloudCredential.provider };
    },
    invalidates: [queryKeys.cloudCredentials()],
  });
