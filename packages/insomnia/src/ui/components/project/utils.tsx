import { useState } from 'react';

// TODO: remove unused view value
export type ActiveView = 'project' | 'git-results';

export function useActiveView() {
  const [activeView, setActiveView] = useState<ActiveView>('project');
  return { activeView, setActiveView };
}

export interface ProjectData {
  name: string;
  uri?: string;
  ref?: string;
  credentialsId?: string;
  connectRepositoryLater?: boolean;
  selectedAuthorEmail?: string | null;
}

export type ProjectType = 'local' | 'remote' | 'git';
