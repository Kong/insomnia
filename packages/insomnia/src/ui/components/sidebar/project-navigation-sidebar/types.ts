import type { InsomniaFile } from '~/common/project';
import type { BaseModel, GitRepository, Project, RequestGroup, Workspace, WorkspaceMeta } from '~/insomnia-data';
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

// Unsynced workspace in cloud sync project
type UnsyncedWorkspaceDoc = InsomniaFile & { _id: string };
export type UnsyncedWorkspaceFlatItem = Omit<BaseFlatItem<any>, 'doc'> &
  Pick<WorkspaceFlatItem, 'project'> & {
    kind: 'unsyncedWorkspace';
    doc: UnsyncedWorkspaceDoc;
  };

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

export interface PinnedRequestFlatItem extends Omit<CollectionChildFlatItem, 'kind'> {
  kind: 'pinnedRequest';
  isFirstPinned: boolean;
  isLastPinned: boolean;
}

export interface PinnedHeaderFlatItem {
  kind: 'pinnedHeader';
  hidden: boolean;
  doc: { _id: string; name: string };
}

export interface EmptyNodeFlatItem {
  kind: 'emptyProject' | 'emptyCollection' | 'emptyFolder';
  hidden: boolean;
  organizationId: string;
  doc: { _id: string; name: string };
  project: ProjectWithPresence;
  workspace?: Workspace;
  requestGroup?: RequestGroup;
  level?: number;
}

export type FlatItem =
  | ProjectFlatItem
  | WorkspaceFlatItem
  | CollectionChildFlatItem
  | UnsyncedWorkspaceFlatItem
  | PinnedRequestFlatItem
  | PinnedHeaderFlatItem
  | EmptyNodeFlatItem;
