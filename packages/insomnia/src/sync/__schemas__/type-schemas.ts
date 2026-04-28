import { createBuilder, type Schema } from '@develohpanda/fluent-builder';

import { baseModelSchema } from '../../models/__schemas__/model-schemas';
import type {
  BackendProject,
  BackendProjectWithTeam,
  Branch,
  MergeConflict,
  SnapshotStateEntry,
  StatusCandidate,
  Team,
} from '../types';

export const projectSchema: Schema<BackendProject> = {
  id: () => 'id',
  rootDocumentId: () => 'rootDocumentId',
  name: () => 'name',
};

export const teamSchema: Schema<Team> = {
  id: () => 'teamId',
  name: () => 'teamName',
};

export const backendProjectWithTeamSchema: Schema<BackendProjectWithTeam> = {
  ...projectSchema,
  team: () => createBuilder(teamSchema).build(),
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
  mineBlobContent: () => null,
  theirsBlob: () => null,
  theirsBlobContent: () => null,
  message: () => 'message',
  name: () => 'name',
  suggestedMergeResult: () => '',
  mergeResult: () => '',
  resolutionSource: () => 'choose',
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
