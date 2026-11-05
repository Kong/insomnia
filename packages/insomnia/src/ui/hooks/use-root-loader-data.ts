import type { Settings, UserSession } from 'insomnia-data';
import { useRouteLoaderData } from 'react-router';

export interface RootLoaderData {
  settings: Settings;
  userSession: UserSession;
}

export const useRootLoaderData = () => {
  return useRouteLoaderData('root') as RootLoaderData | undefined;
};
