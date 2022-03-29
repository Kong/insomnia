import { BaseModel } from '../models';

export interface Team {
  id: string;
  name: string;
}

export interface BackendProject {
  id: string;
  name: string;
  rootDocumentId: string;
}

export type DocumentKey = string;

export type BlobId = string;

export interface Head {
  branch: string;
}

export interface SnapshotStateEntry {
  key: DocumentKey;
  blob: BlobId;
  name: string;
}

export type SnapshotState = SnapshotStateEntry[];

export type SnapshotStateMap = Record<DocumentKey, SnapshotStateEntry>;

export type SnapshotId = string;

export interface Snapshot {
  id: SnapshotId;
  created: Date;
  parent: string;
  author: string;
  name: string;
  description: string;
  state: SnapshotStateEntry[];
  // Only exists in Snapshots that are pulled from the server
  authorAccount?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface Branch {
  name: string;
  created: Date;
  modified: Date;
  snapshots: string[];
}

export interface StageEntryDelete {
  deleted: true;
  key: string;
  name: string;
  blobId: string;
}

export interface StageEntryAdd {
  added: true;
  key: string;
  name: string;
  blobId: string;
  blobContent: string;
}

export interface StageEntryModify {
  modified: true;
  key: string;
  name: string;
  blobId: string;
  blobContent: string;
}

export type StageEntry = StageEntryDelete | StageEntryAdd | StageEntryModify;

export interface MergeConflict {
  name: string;
  key: DocumentKey;
  message: string;
  mineBlob: BlobId | null;
  theirsBlob: BlobId | null;
  choose: BlobId | null;
}

export type Stage = Record<DocumentKey, StageEntry>;

export interface StatusCandidate {
  key: DocumentKey;
  name: string;
  document: BaseModel;
}

export type StatusCandidateMap = Record<DocumentKey, StatusCandidate>;

export interface Status {
  key: string;
  stage: Stage;
  unstaged: Record<DocumentKey, StageEntry>;
}
