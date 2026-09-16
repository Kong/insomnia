import type { GitRepository, Project } from 'insomnia-data';
import { useRouteLoaderData } from 'react-router';

export interface ProjectLoaderData {
  activeProject: Project;
  activeProjectGitRepository: GitRepository | undefined;
}

// Reads the project route's loader data by route id so consumers don't import the route module —
// that route renders the sidebar/panes that call this hook, so importing it would close a
// route <-> component cycle. The route's `clientLoader` conforms to `ProjectLoaderData`.
export const useProjectLoaderData = () =>
  useRouteLoaderData('routes/organization.$organizationId.project.$projectId') as ProjectLoaderData | undefined;
