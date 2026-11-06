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

export function useInvalidatingDBMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult> & {
    invalidates: readonly QueryKey[] | ((data: TData, vars: TVariables) => readonly QueryKey[]);
  },
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  const dbQueryClient = useDBQueryClient();
  return useMutation(
    {
      ...options,
      onSuccess: async (data, vars, result, context) => {
        if (options.onSuccess) {
          options.onSuccess(data, vars, result, context);
        }
        const keys = typeof options.invalidates === 'function' ? options.invalidates(data, vars) : options.invalidates;
        await Promise.all(keys.map(queryKey => dbQueryClient.invalidateQueries({ queryKey })));
      },
    },
    dbQueryClient,
  );
}

// Binds to the server-data (network) query client
export function useServerMutation<TData = unknown, TError = Error, TVariables = void, TOnMutateResult = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  return useMutation(options, useServerDataQueryClient());
}
