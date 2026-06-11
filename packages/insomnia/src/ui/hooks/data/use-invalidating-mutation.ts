import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
export function useInvalidatingMutation<TData, TVars, TError = Error>(options: {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidates: readonly QueryKey[] | ((data: TData, vars: TVars) => readonly QueryKey[]);
}) {
  const queryClient = useQueryClient();
  return useMutation<TData, TError, TVars>({
    mutationFn: options.mutationFn,
    onSuccess: (data, vars) => {
      const keys = typeof options.invalidates === 'function'
        ? options.invalidates(data, vars)
        : options.invalidates;
      keys.forEach(queryKey => queryClient.invalidateQueries({ queryKey }));
    },
  });
}
