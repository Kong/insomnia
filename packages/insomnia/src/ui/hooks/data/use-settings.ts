import { services, type Settings } from 'insomnia-data';
import { useRevalidator, useRouteLoaderData } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import { useInvalidatingDBMutation } from '~/ui/hooks/use-mutations';
import { useDBQuery } from '~/ui/hooks/use-query';

export const settingsKeys = {
  all: ['settings'],
};

export const useSettings = (): Settings => {
  // The root loader has already read the settings, so they are the value until the query resolves
  const loaderSettings = useRouteLoaderData('root')?.settings;
  const { data } = useDBQuery({
    queryKey: settingsKeys.all,
    queryFn: () => services.settings.get(),
  });
  const settings = data ?? loaderSettings;
  invariant(settings, 'useSettings must be used below the root route');
  return settings;
};

export const useUpdateSettings = () => {
  const { revalidate } = useRevalidator();
  return useInvalidatingDBMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      if ('enableAnalytics' in patch && !patch.enableAnalytics) {
        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.analyticsDisabled });
      }
      await services.settings.patch(patch);
    },
    invalidates: [settingsKeys.all],
    onSuccess: (_data, patch) => {
      // The request loader filters its response list by this setting, and TanStack mutations don't revalidate loaders.
      if ('filterResponsesByEnv' in patch) {
        revalidate();
      }
    },
  });
};
