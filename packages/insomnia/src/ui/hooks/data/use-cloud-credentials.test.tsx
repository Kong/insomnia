/**
 * @vitest-environment jsdom
 */
import { QueryClient } from '@tanstack/react-query';
import type { CloudProviderCredential } from 'insomnia-data';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCloudCredentials,
  useCreateCloudCredential,
  useDeleteCloudCredential,
  useUpdateCloudCredential,
} from './use-cloud-credentials';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const renderHook = <T,>(useHook: () => T) => {
  const result = { current: undefined as unknown as T };
  const Harness = () => {
    result.current = useHook();
    return null;
  };
  act(() => {
    createRoot(document.createElement('div')).render(<Harness />);
  });
  return { result };
};

// Mutation state changes re-render the harness, so settle them inside act.
const run = async <T,>(fn: () => Promise<T>) => {
  let value!: T;
  await act(async () => {
    value = await fn();
  });
  return value;
};

const mocks = vi.hoisted(() => ({
  queryClient: undefined as unknown as QueryClient,
  executePluginMainAction: vi.fn(),
  cloudCredential: {
    all: vi.fn(),
    getByName: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('insomnia-data', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  services: { cloudCredential: mocks.cloudCredential },
}));

vi.mock('~/ui/plugins/renderer-bridge', () => ({
  plugins: { executePluginMainAction: mocks.executePluginMainAction },
}));

vi.mock('~/ui/context/app/insomnia-app-data-context', () => ({
  useDBQueryClient: () => mocks.queryClient,
}));

const token = { access_token: 'token', expires_at: 123 };
const authSuccess = { success: true, result: token };
const authFailure = { error: { errorMessage: 'bad credentials' } };

const buildHashicorpCredentials = () => ({ type: 'onPrem', serverAddress: 'http://vault' });

describe('use-cloud-credentials', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  describe('useCloudCredentials', () => {
    it('is pending with an empty list until the query resolves', async () => {
      const stored = [{ _id: 'cc_1' }] as CloudProviderCredential[];
      mocks.cloudCredential.all.mockResolvedValue(stored);

      const { result } = renderHook(() => useCloudCredentials());

      expect(result.current).toEqual({ cloudCredentials: [], isPending: true });
      await vi.waitFor(async () => {
        await act(async () => {});
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.cloudCredentials).toBe(stored);
    });
  });

  describe('useCreateCloudCredential', () => {
    it('rejects with the plugin error message and does not write', async () => {
      mocks.executePluginMainAction.mockResolvedValue(authFailure);
      const { result } = renderHook(() => useCreateCloudCredential());

      await expect(
        run(() =>
          result.current.mutateAsync({
            name: 'n',
            provider: 'hashicorp',
            credentials: buildHashicorpCredentials() as any,
          }),
        ),
      ).rejects.toThrow('bad credentials');

      expect(mocks.cloudCredential.create).not.toHaveBeenCalled();
    });

    it('rejects on an unexpected plugin response', async () => {
      mocks.executePluginMainAction.mockResolvedValue({ success: false });
      const { result } = renderHook(() => useCreateCloudCredential());

      await expect(
        run(() => result.current.mutateAsync({ name: 'n', provider: 'aws', credentials: {} as any })),
      ).rejects.toThrow('Unexpected response from aws');
      expect(mocks.cloudCredential.create).not.toHaveBeenCalled();
    });

    it('rejects when required fields are missing', async () => {
      const { result } = renderHook(() => useCreateCloudCredential());

      await expect(
        run(() => result.current.mutateAsync({ name: '', provider: 'aws', credentials: {} as any })),
      ).rejects.toThrow('Name is required');
      expect(mocks.executePluginMainAction).not.toHaveBeenCalled();
    });

    it('stores the hashicorp token on a copy without mutating the caller credentials', async () => {
      mocks.executePluginMainAction.mockResolvedValue(authSuccess);
      const credentials = buildHashicorpCredentials();
      const { result } = renderHook(() => useCreateCloudCredential());

      const data = await run(() =>
        result.current.mutateAsync({ name: 'n', provider: 'hashicorp', credentials: credentials as any }),
      );

      expect(data).toEqual(token);
      expect(credentials).toEqual(buildHashicorpCredentials());
      expect(mocks.cloudCredential.create).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: { ...buildHashicorpCredentials(), ...token } }),
      );
    });

    it('creates other providers with the credentials untouched', async () => {
      mocks.executePluginMainAction.mockResolvedValue(authSuccess);
      const credentials = { accessKeyId: 'a' };
      const { result } = renderHook(() => useCreateCloudCredential());

      await run(() => result.current.mutateAsync({ name: 'n', provider: 'aws', credentials: credentials as any }));

      expect(mocks.cloudCredential.create).toHaveBeenCalledWith(expect.objectContaining({ credentials }));
    });

    it('creates an oauth credential without authenticating when none with the same name exists', async () => {
      mocks.cloudCredential.getByName.mockResolvedValue([]);
      const credentials = { accessToken: 'x' };
      const { result } = renderHook(() => useCreateCloudCredential());

      const data = await run(() =>
        result.current.mutateAsync({
          name: 'n',
          provider: 'azure',
          credentials: credentials as any,
          isAuthenticated: true,
        }),
      );

      expect(data).toBe(credentials);
      expect(mocks.executePluginMainAction).not.toHaveBeenCalled();
      expect(mocks.cloudCredential.create).toHaveBeenCalledTimes(1);
      expect(mocks.cloudCredential.update).not.toHaveBeenCalled();
    });

    it('updates the existing oauth credential with the same name instead of creating a duplicate', async () => {
      const existing = { _id: 'cc_1' };
      mocks.cloudCredential.getByName.mockResolvedValue([existing]);
      const { result } = renderHook(() => useCreateCloudCredential());

      await run(() =>
        result.current.mutateAsync({
          name: 'n',
          provider: 'azure',
          credentials: { accessToken: 'x' } as any,
          isAuthenticated: true,
        }),
      );

      expect(mocks.cloudCredential.update).toHaveBeenCalledWith(existing, expect.objectContaining({ name: 'n' }));
      expect(mocks.cloudCredential.create).not.toHaveBeenCalled();
    });
  });

  describe('useUpdateCloudCredential', () => {
    const origin = { _id: 'cc_1' };

    it('rejects with the plugin error message and leaves the stored credential alone', async () => {
      mocks.executePluginMainAction.mockResolvedValue(authFailure);
      const { result } = renderHook(() => useUpdateCloudCredential());

      await expect(
        run(() =>
          result.current.mutateAsync({
            cloudCredentialId: 'cc_1',
            patch: { name: 'n', provider: 'hashicorp', credentials: buildHashicorpCredentials() as any },
          }),
        ),
      ).rejects.toThrow('bad credentials');

      expect(mocks.cloudCredential.update).not.toHaveBeenCalled();
    });

    it('rejects when the credential no longer exists', async () => {
      mocks.executePluginMainAction.mockResolvedValue(authSuccess);
      mocks.cloudCredential.getById.mockResolvedValue(null);
      const { result } = renderHook(() => useUpdateCloudCredential());

      await expect(
        run(() =>
          result.current.mutateAsync({
            cloudCredentialId: 'cc_1',
            patch: { name: 'n', provider: 'aws', credentials: {} as any },
          }),
        ),
      ).rejects.toThrow('No Cloud Credential found');
      expect(mocks.cloudCredential.update).not.toHaveBeenCalled();
    });

    it('stores the hashicorp token on a copy', async () => {
      mocks.executePluginMainAction.mockResolvedValue(authSuccess);
      mocks.cloudCredential.getById.mockResolvedValue(origin);
      const credentials = buildHashicorpCredentials();
      const { result } = renderHook(() => useUpdateCloudCredential());

      const data = await run(() =>
        result.current.mutateAsync({
          cloudCredentialId: 'cc_1',
          patch: { name: 'n', provider: 'hashicorp', credentials: credentials as any },
        }),
      );

      expect(data).toEqual(token);
      expect(credentials).toEqual(buildHashicorpCredentials());
      expect(mocks.cloudCredential.update).toHaveBeenCalledWith(
        origin,
        expect.objectContaining({ credentials: { ...buildHashicorpCredentials(), ...token } }),
      );
    });
  });

  describe('useDeleteCloudCredential', () => {
    it('removes the credential', async () => {
      const stored = { _id: 'cc_1', name: 'n', provider: 'aws' };
      mocks.cloudCredential.getById.mockResolvedValue(stored);
      const { result } = renderHook(() => useDeleteCloudCredential());

      const data = await run(() => result.current.mutateAsync('cc_1'));

      expect(data).toEqual({ name: 'n', provider: 'aws' });
      expect(mocks.cloudCredential.remove).toHaveBeenCalledWith(stored);
    });

    it('rejects when the credential does not exist', async () => {
      mocks.cloudCredential.getById.mockResolvedValue(null);
      const { result } = renderHook(() => useDeleteCloudCredential());

      await expect(run(() => result.current.mutateAsync('cc_missing'))).rejects.toThrow('Cloud Credential not found');
      expect(mocks.cloudCredential.remove).not.toHaveBeenCalled();
    });
  });
});
