import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export type Variables<T> = Partial<T> | ((variables: T) => Promise<Partial<T>> | Partial<T>);

export function useOptimisticMutation(
  options: Parameters<typeof useMutation>[0] & { invalidateKey: any[]; patch: boolean },
) {
  const { invalidateKey, mutationFn, onMutate, onSettled, patch, ...rest } = options;
  const mutation = useMutation({
    ...rest,
    mutationFn: (...args: any) => {
      const [variables, { client }] = args;
      const previousSettings = client.getQueryData(invalidateKey);
      client.setQueryData(invalidateKey, patch ? { ...previousSettings, ...variables } : variables);

      return mutationFn?.(...args);
    },
    // before the mutation
    onMutate: (...args: any) => {
      const [_, { client }] = args;
      const previous = client.getQueryData(invalidateKey);
      const result = onMutate?.(...args) || {};
      return { _previous: previous, ...result };
    },
    onSettled: (...args: any) => {
      const [data, error, variables, { _previous }, { client }] = args;
      if (error && _previous) {
        // rollback first
        client.setQueryData(invalidateKey, _previous);
      }
      onSettled?.(...args);
      // Always refetch after error or success:
      client.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  const client = useQueryClient();
  const { mutate } = mutation;

  const mutateResult = useCallback(
    <T>(doMutation: Variables<T>) => {
      const settings = client.getQueryData(invalidateKey);
      let result;
      if (typeof doMutation === 'function') {
        result = doMutation(settings);
        if (result instanceof Promise) {
          result.then(res => {
            if (settings !== res) {
              mutate(res);
            }
          });
          return;
        }
      }
      if (settings !== result) {
        mutate(result);
      }
    },
    [client, mutate, invalidateKey], // invalidateKey is not expected to change, but we include it for completeness
  );

  return { ...mutation, mutateResult };
}
