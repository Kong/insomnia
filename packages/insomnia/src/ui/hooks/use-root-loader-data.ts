import type { Settings, UserSession } from 'insomnia-data';
import { useRouteLoaderData } from 'react-router';

// What the root loader returns. `settings` is only the initial snapshot that `useSettings` falls back to.
export interface RootLoaderData {
  settings: Settings;
  userSession: UserSession;
}

// Settings are deliberately left out of the return type: a TanStack mutation doesn't revalidate the loader, so
// this snapshot goes stale. Read them with `useSettings` instead.
export const useRootLoaderData = () => {
  return useRouteLoaderData('root') as Omit<RootLoaderData, 'settings'> | undefined;
};
