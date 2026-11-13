import { type CloudProviderCredential, services } from 'insomnia-data';

import { cloudCredentialKeys } from '~/common/app-data';
import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';
import { invariant } from '~/common/utils/invariant';
import { useDBMutation } from '~/ui/hooks/use-mutations';
import { useDBQuery } from '~/ui/hooks/use-query';
import { plugins } from '~/ui/plugins/renderer-bridge';

type CreateCloudCredentialData = Pick<CloudProviderCredential, 'name' | 'provider' | 'credentials'> & {
  isAuthenticated?: boolean;
  provider: string;
};

interface AuthenticateResult { access_token: string; expires_at: number }

const EMPTY_CLOUD_CREDENTIALS: CloudProviderCredential[] = [];

// Refreshed by updateAppDataOnDbChanges, so the mutations below don't invalidate it themselves.
export const useCloudCredentials = () => {
  const { data, isPending } = useDBQuery({
    queryKey: cloudCredentialKeys.all,
    queryFn: () => services.cloudCredential.all(),
  });
  return { cloudCredentials: data ?? EMPTY_CLOUD_CREDENTIALS, isPending };
};

// Throws on failure so the mutation's `error` / `onError` / `onSuccess` reflect the real outcome.
const authenticate = async (provider: string, credentials: unknown) => {
  const response = (await plugins.executePluginMainAction({
    pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
    actionName: 'authenticate',
    params: { provider, credentials },
  })) as any;
  const { success, error, result } = response;
  if (error) {
    throw new Error(`${error.errorMessage}`);
  }
  if (!success) {
    throw new Error('Unexpected response from ' + provider);
  }
  return result as AuthenticateResult;
};

// Returns a copy so the caller's form data is never mutated.
const withHashicorpToken = <T extends Partial<CloudProviderCredential>>(
  patch: T,
  provider: string,
  { access_token, expires_at }: AuthenticateResult,
): T =>
  provider === 'hashicorp'
    ? { ...patch, credentials: { ...patch.credentials, access_token, expires_at } as T['credentials'] }
    : patch;

export const useCreateCloudCredential = () =>
  useDBMutation({
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

      const result = await authenticate(provider, credentials);
      await services.cloudCredential.create(
        withHashicorpToken(patch as Partial<CloudProviderCredential>, provider, result),
      );
      return result;
    },
  });

export const useUpdateCloudCredential = () =>
  useDBMutation({
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

      const result = await authenticate(provider, credentials);
      const originCredential = await services.cloudCredential.getById(cloudCredentialId);
      invariant(originCredential, 'No Cloud Credential found');
      await services.cloudCredential.update(originCredential, withHashicorpToken(patch, provider, result));
      return result;
    },
  });

export const useDeleteCloudCredential = () =>
  useDBMutation({
    mutationFn: async (cloudCredentialId: string) => {
      invariant(typeof cloudCredentialId === 'string', 'Cloud Credential ID is required');
      const cloudCredential = await services.cloudCredential.getById(cloudCredentialId);
      invariant(cloudCredential, 'Cloud Credential not found');
      await services.cloudCredential.remove(cloudCredential);
      return { name: cloudCredential.name, provider: cloudCredential.provider };
    },
  });
