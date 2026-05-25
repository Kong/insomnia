import type { StorageRules } from 'insomnia-api';
import { Button } from 'react-aria-components';

import { models } from '~/insomnia-data';
import { ProjectDropdown } from '~/ui/components/dropdowns/project-dropdown';

import { AvatarGroup } from '../../avatar';
import { Icon } from '../../icon';
import { ACTIVE_BORDER_CLASS, ICON_CLASS, ROW_CLASS, TOGGLE_BTN_CLASS } from './project-navigation-sidebar-utils';
import { type ProjectFlatItem } from './types';

interface ProjectNodeProps {
  item: ProjectFlatItem;
  storageRules: StorageRules;
  onToggle: (projectId: string) => void;
}

export const ProjectNode = ({ item, storageRules, onToggle }: ProjectNodeProps) => {
  const { doc, collapsed, organizationId } = item;
  const { name: projectName, presence, _id: projectId } = doc;
  return (
    <div className={ROW_CLASS} style={{ paddingLeft: '1em' }} data-testid={`project-node-${projectName}`}>
      <span className={ACTIVE_BORDER_CLASS} />
      <Button slot="drag" className="hidden" />
      <Button
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${projectName}`}
        onPress={() => onToggle(projectId)}
        className={TOGGLE_BTN_CLASS}
      >
        <Icon icon={collapsed ? 'chevron-right' : 'chevron-down'} className={ICON_CLASS} />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left transition-colors">
        <Icon
          icon={
            models.project.isRemoteProject(doc)
              ? 'globe-americas'
              : models.project.isGitProject(doc)
                ? ['fab', 'git-alt']
                : 'laptop'
          }
        />
        <span className="min-w-0 flex-1 truncate text-base text-[rgb(var(--color-font-rgb),0.8)]">{projectName}</span>
      </div>
      {presence.length > 0 && <AvatarGroup size="small" maxAvatars={3} items={presence} />}
      {projectId !== models.project.SCRATCHPAD_PROJECT_ID && (
        <ProjectDropdown organizationId={organizationId} project={doc} storageRules={storageRules} />
      )}
    </div>
  );
};
