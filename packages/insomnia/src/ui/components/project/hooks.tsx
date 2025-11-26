import { useState } from 'react';

export function useActiveView() {
  const [activeView, setActiveView] = useState<'project' | 'git-results'>('project');
  return { activeView, setActiveView };
}
