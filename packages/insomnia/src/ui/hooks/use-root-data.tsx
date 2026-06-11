import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services, type Settings, type UserSession } from 'insomnia-data';

import { useRootLoaderData } from '~/root';
import { AnalyticsEvent } from '~/ui/analytics';

type RootDataTypes = 'settings' | 'userSession';

export const rootDataQueryKey = (type: RootDataTypes) => ['root', type];
const rootDataMutationFns = {
  settings: {
    update: async (patch: Partial<Settings>) => {
      if ('enableAnalytics' in patch && !patch.enableAnalytics) {
        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.analyticsDisabled });
      }
      return services.settings.patch(patch);
    },
  },
  userSession: {
    update: async (data: Partial<UserSession>) => await services.userSession.update(data),
  },
};

export const useRootData = (type: RootDataTypes) => {
  const initialData = useRootLoaderData()!;
  const { data } = useQuery({
    queryKey: rootDataQueryKey(type),
    queryFn: async () => {
      switch (type) {
        case 'settings': {
          return await services.settings.get();
        }
        case 'userSession': {
          return await services.userSession.get();
        }
        default: {
          throw new Error(`Unknown root data type: ${type}`);
        }
      }
    },
    initialData: initialData[type],
  });
  return data;
};

export const useRootDataPatcher = (type: RootDataTypes) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: any) => rootDataMutationFns[type].update(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rootDataQueryKey(type) });
    },
  });
};
