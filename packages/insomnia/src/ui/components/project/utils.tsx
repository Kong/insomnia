import { useState } from 'react';

import type { OauthProviderName } from '../../../models/git-credentials';

export type ActiveView = 'project' | 'git-results' | 'git-clone' | 'switch-storage-type';

export function useActiveView() {
  const [activeView, setActiveView] = useState<ActiveView>('project');
  return { activeView, setActiveView };
}

export interface ProjectData {
  name: string;
  authorName?: string;
  authorEmail?: string;
  uri?: string;
  ref?: string;
  username?: string;
  password?: string;
  token?: string;
  oauth2format?: OauthProviderName;
  connectRepositoryLater?: boolean;
}
