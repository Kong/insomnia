import { useQuery } from '@tanstack/react-query';
import { services, type UserSession } from 'insomnia-data';
import { useRouteLoaderData } from 'react-router';

import { queryKeys } from './query-keys';
import { useInvalidatingMutation } from './use-invalidating-mutation';

export const useUserSession = () => {
  const { data } = useQuery({
    queryKey: queryKeys.userSession(),
    queryFn: async () => await services.userSession.get(),
    initialData: useRouteLoaderData('root')!.userSession as UserSession,
  });
  return data;
};

export const useUpdateUserSession = () =>
  useInvalidatingMutation({
    mutationFn: (patch: Partial<UserSession>) => services.userSession.update(patch),
    invalidates: [queryKeys.userSession()],
  });
