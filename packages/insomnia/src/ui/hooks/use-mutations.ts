import type { QueryKey, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';

import { useDBQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';

// Binds to the local database cache's query client
export function useDBMutation<TData = unknown, TError = Error, TVariables = void, TOnMutateResult = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  return useMutation(options, useDBQueryClient());
}

// Runs the mutation against the chosen query client then invalidates the given query keys on that same client once it succeeds.
export function useMutationWithAutoInvalidation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult> & {
    client: 'db' | 'server';
    invalidates: readonly QueryKey[] | ((data: TData, vars: TVariables) => readonly QueryKey[]);
  },
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  const dbQueryClient = useDBQueryClient();
  const serverQueryClient = useServerDataQueryClient();
  const queryClient = options.client === 'db' ? dbQueryClient : serverQueryClient;
  const { client: _client, invalidates, ...mutationOptions } = options;
  return useMutation(
    {
      ...mutationOptions,
      onSuccess: async (data, vars, result, context) => {
        if (mutationOptions.onSuccess) {
          await mutationOptions.onSuccess(data, vars, result, context);
        }
        const keys = typeof invalidates === 'function' ? invalidates(data, vars) : invalidates;
        await Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
      },
    },
    queryClient,
  );
}

// Binds to the server-data (network) query client
export function useServerMutation<TData = unknown, TError = Error, TVariables = void, TOnMutateResult = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  return useMutation(options, useServerDataQueryClient());
}
