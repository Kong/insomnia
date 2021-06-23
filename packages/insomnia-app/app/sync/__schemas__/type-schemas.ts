import { createBuilder, Schema } from '@develohpanda/fluent-builder';
import { baseModelSchema } from '../../models/__schemas__/model-schemas';
import { Branch, MergeConflict, Project, SnapshotStateEntry, StatusCandidate } from '../types';

export const projectSchema: Schema<Project> = {
  id: () => 'id',
  rootDocumentId: () => 'rootDocumentId',
  name: () => 'name',
};

export const branchSchema: Schema<Branch> = {
  created: () => new Date(0),
  modified: () => new Date(0),
  name: () => '',
  snapshots: () => [],
};

export const mergeConflictSchema: Schema<MergeConflict> = {
  key: () => 'key',
  choose: () => null,
  mineBlob: () => null,
  theirsBlob: () => null,
  message: () => 'message',
  name: () => 'name',
};

export const statusCandidateSchema: Schema<StatusCandidate> = {
  key: () => 'key',
  name: () => 'name',
  document: () => createBuilder(baseModelSchema).build(),
};

export const snapshotStateEntrySchema: Schema<SnapshotStateEntry> = {
  blob: () => 'blob',
  key: () => 'key',
  name: () => 'name',
};
