// @flow

export type Team = {
  id: string,
  name: string,
};

export type Project = {
  id: string,
  name: string,
  rootDocumentId: string,
};

export type DocumentKey = string;
export type BlobId = string;

export type Head = {|
  branch: string,
|};

export type SnapshotStateEntry = {|
  key: DocumentKey,
  blob: BlobId,
  name: string,
|};

export type SnapshotState = Array<SnapshotStateEntry>;
export type SnapshotStateMap = { [DocumentKey]: SnapshotStateEntry };
export type SnapshotId = string;

export type Snapshot = {|
  id: SnapshotId,
  created: Date,
  parent: string,
  author: string,
  name: string,
  description: string,
  state: Array<SnapshotStateEntry>,

  // Only exists in Snapshots that are pulled from the server
  authorAccount?: {
    firstName: string,
    lastName: string,
    email: string,
  },
|};

export type Branch = {|
  name: string,
  created: Date,
  modified: Date,
  snapshots: Array<string>,
|};

export type StageEntryDelete = {|
  deleted: true,
  key: string,
  name: string,
  blobId: string,
|};

export type StageEntryAdd = {|
  added: true,
  key: string,
  name: string,
  blobId: string,
  blobContent: string,
|};

export type StageEntryModify = {|
  modified: true,
  key: string,
  name: string,
  blobId: string,
  blobContent: string,
|};

export type StageEntry = StageEntryDelete | StageEntryAdd | StageEntryModify;

export type MergeConflict = {|
  name: string,
  key: DocumentKey,
  message: string,
  mineBlob: BlobId | null,
  theirsBlob: BlobId | null,
  choose: BlobId | null,
|};

export type Stage = {
  [DocumentKey]: StageEntry,
};

export type StatusCandidate = {|
  key: DocumentKey,
  name: string,
  document: Object,
|};

export type StatusCandidateMap = { [DocumentKey]: StatusCandidate };

export type Status = {|
  key: string,
  stage: Stage,
  unstaged: {
    [DocumentKey]: StageEntry,
  },
|};
