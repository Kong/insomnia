import { useQuery } from '@tanstack/react-query';
import { services, type Settings } from 'insomnia-data';
import { useRouteLoaderData } from 'react-router';

import { AnalyticsEvent } from '~/ui/analytics';

import { queryKeys } from './query-keys';
import { useInvalidatingMutation } from './use-invalidating-mutation';

export const useSettings = () => {
  const { data } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: async () => await services.settings.get(),
    initialData: useRouteLoaderData('root')!.settings as Settings,
  });
  return data;
};

export const useUpdateSettings = () =>
  useInvalidatingMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      if ('enableAnalytics' in patch && !patch.enableAnalytics) {
        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.analyticsDisabled });
      }
      return services.settings.patch(patch);
    },
    invalidates: [queryKeys.settings()],
  });
