import type { BaseModel } from '~/insomnia-data';

export type DocumentKey = string;

export type BlobId = string;

export interface StageEntryDelete {
  deleted: true;
  key: string;
  name: string;
  blobId: BlobId;
  previousBlobContent?: string;
}

export interface StageEntryAdd {
  added: true;
  key: string;
  name: string;
  blobId: BlobId;
  blobContent: string;
}

export interface StageEntryModify {
  modified: true;
  key: string;
  name: string;
  blobId: BlobId;
  blobContent: string;
  previousBlobContent?: string;
}

export type StageEntry = StageEntryDelete | StageEntryAdd | StageEntryModify;

export type Stage = Record<DocumentKey, StageEntry>;

export interface StatusCandidate {
  key: DocumentKey;
  name: string;
  document: BaseModel;
}

export interface Status {
  key: string;
  stage: Stage;
  unstaged: Record<DocumentKey, StageEntry>;
}

export interface SyncVCSLike {
  hasBackendProject: () => boolean | Promise<boolean>;
  push: (options: { teamId: string; teamProjectId: string }) => Promise<void>;
  stage: (stageEntries: StageEntry[]) => Promise<Stage>;
  status: (candidates: StatusCandidate[]) => Promise<Status>;
  switchAndCreateBackendProjectIfNotExist: (rootDocumentId: string, name: string) => Promise<void>;
  takeSnapshot: (name: string) => Promise<void>;
}
