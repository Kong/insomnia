import type { GitRepository, Project } from 'insomnia-data';
import { useParams } from 'react-router';

import { organizationDataQuery } from '~/common/app-data';
import { useDBQuery } from '~/ui/hooks/use-query';

interface ActiveProjectData {
  activeProject: Project | undefined;
  activeProjectGitRepository: GitRepository | undefined;
}

const noActiveProject: ActiveProjectData = { activeProject: undefined, activeProjectGitRepository: undefined };

/**
 * The project in the URL, derived from the organization data query (the project route's loader
 * prefetches it), so it follows `db.changes` — e.g. a project renamed or turned local by the
 * startup sync — without any loader having to re-run. Returns undefined outside a project route.
 * Inside the project route's content `activeProject` is always set: the route renders the content
 * only while the project exists.
 *
 * Subscribes to the project only (`select`): organization data changes all the time (workspace
 * metas are patched into it on every write), and the selected result keeps its reference while
 * the project itself is unchanged, so those changes don't re-render the callers.
 */
export function useActiveProject(): ActiveProjectData | undefined {
  const { organizationId = '', projectId } = useParams();
  const { data } = useDBQuery({
    ...organizationDataQuery(organizationId),
    enabled: Boolean(organizationId && projectId),
    select: (organizationData): ActiveProjectData => {
      const projectWithGitRepository = organizationData.projects.find(p => p._id === projectId);
      if (!projectWithGitRepository) {
        return noActiveProject;
      }
      // Strip the joined repository: consumers pass the project to `services.project.update`, which
      // would otherwise persist it onto the project doc.
      const { gitRepository, ...activeProject } = projectWithGitRepository;
      return { activeProject: activeProject as Project, activeProjectGitRepository: gitRepository };
    },
  });

  if (!projectId) {
    return;
  }
  return data ?? noActiveProject;
}
