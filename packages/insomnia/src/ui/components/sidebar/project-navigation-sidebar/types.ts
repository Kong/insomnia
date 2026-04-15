import type { GitRepository, Project, Workspace, WorkspaceMeta } from '~/insomnia-data';
import type { BaseModel } from '~/models/types';
import type { Child } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

export type ProjectWithPresence = Project & {
  gitRepository?: GitRepository;
  presence: {
    key: string;
    alt: string;
    src: string;
  }[];
};

export interface WorkspaceSummary {
  workspace: Workspace;
  meta: WorkspaceMeta;
}

interface BaseFlatItem<T extends BaseModel> {
  // database doc associated with this item
  doc: T;
  // indicates whether the item is collapsed or not
  collapsed: boolean;
  // indicates whether the item is hidden due to filter
  hidden: boolean;
  // parent organization id
  organizationId: string;
}

export interface ProjectFlatItem extends BaseFlatItem<ProjectWithPresence> {
  kind: 'project';
}

export interface WorkspaceFlatItem extends BaseFlatItem<Workspace> {
  kind: 'workspace';
  // parent project
  project: ProjectWithPresence;
}
// Collection child items including all kinds of request and request group (folder)
export interface CollectionChildFlatItem extends BaseFlatItem<Child['doc']> {
  kind: 'collectionChild';
  // parent project
  project: ProjectWithPresence;
  // parent workspace
  workspace: Workspace;
  // nested children for request group
  children?: Child[];
  ancestors?: string[];
  level: number;
  pinned: boolean;
}

export type FlatItem = ProjectFlatItem | WorkspaceFlatItem | CollectionChildFlatItem;
