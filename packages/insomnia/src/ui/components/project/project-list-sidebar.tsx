import type { StorageRules } from 'insomnia-api';
import { Button, GridList, GridListItem, Heading, Input, SearchField } from 'react-aria-components';
import { useNavigate } from 'react-router';
import * as reactUse from 'react-use';

import type { GitRepository } from '~/insomnia-data';
import { isGitProject, isRemoteProject, type Project, SCRATCHPAD_PROJECT_ID } from '~/models/project';
import { SegmentEvent } from '~/ui/analytics';

import { AvatarGroup } from '../avatar';
import { ProjectDropdown } from '../dropdowns/project-dropdown';
import { Icon } from '../icon';

export type ProjectWithPresence = Project & {
  gitRepository?: GitRepository;
  presence: {
    key: string;
    alt: string;
    src: string;
  }[];
};

interface ProjectListSidebarProps {
  organizationId: string;
  activeProjectId?: string;
  projects: ProjectWithPresence[];
  projectsCount: number;
  storageRules: StorageRules;
  onCreateProject: () => void;
}

export const ProjectListSidebar = ({
  organizationId,
  activeProjectId,
  projects,
  projectsCount,
  storageRules,
  onCreateProject,
}: ProjectListSidebarProps) => {
  const navigate = useNavigate();

  const [projectListFilter, setProjectListFilter] = reactUse.useLocalStorage(
    `${organizationId}:project-list-filter`,
    '',
  );

  const filteredProjects = projects.filter(p =>
    projectListFilter ? p.name?.toLowerCase().includes(projectListFilter.toLowerCase()) : true,
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Heading className="p-(--padding-sm) text-xs uppercase">Projects ({projectsCount})</Heading>
      <div className="flex justify-between gap-1 p-(--padding-sm)">
        <SearchField
          aria-label="Projects filter"
          className="group relative flex-1"
          value={projectListFilter || ''}
          isDisabled={projects.length === 0}
          onChange={value => {
            setProjectListFilter(value);

            if (value.trim() !== '') {
              window.main.trackSegmentEvent({
                event: SegmentEvent.filterCreatedProjects,
              });
            }
          }}
        >
          <Input
            placeholder="Filter"
            className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
          />
          <div className="absolute top-0 right-0 flex h-full items-center px-2">
            <Button className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
              <Icon icon="close" />
            </Button>
          </div>
        </SearchField>
        <Button
          aria-label="Create new Project"
          onPress={onCreateProject}
          isDisabled={projects.length === 0}
          className="flex aspect-square h-full items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon="plus-circle" />
        </Button>
      </div>

      <GridList
        aria-label="Projects"
        items={filteredProjects}
        className="flex-1 overflow-y-auto py-(--padding-sm) data-empty:py-0"
        disallowEmptySelection
        selectedKeys={activeProjectId ? [activeProjectId] : ['']}
        selectionMode="single"
        onSelectionChange={keys => {
          if (keys !== 'all') {
            const [value] = keys.values();

            navigate({
              pathname: `/organization/${organizationId}/project/${value}`,
            });
          }
        }}
      >
        {item => {
          return (
            <GridListItem
              key={item._id}
              id={item._id}
              textValue={item.name}
              className="group outline-hidden select-none"
            >
              <div className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                <span className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)" />
                <Icon
                  icon={isRemoteProject(item) ? 'globe-americas' : isGitProject(item) ? ['fab', 'git-alt'] : 'laptop'}
                />
                <span className={'truncate'}>{item.name}</span>
                <span className="flex-1" />
                {item.presence.length > 0 && <AvatarGroup size="small" maxAvatars={3} items={item.presence} />}
                {item._id !== SCRATCHPAD_PROJECT_ID && (
                  <ProjectDropdown organizationId={organizationId} project={item} storageRules={storageRules} />
                )}
              </div>
            </GridListItem>
          );
        }}
      </GridList>
    </div>
  );
};
