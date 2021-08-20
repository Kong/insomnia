import { createBuilder, Schema } from '@develohpanda/fluent-builder';

import { baseModelSchema } from '../../models/__schemas__/model-schemas';
import { BackendProject, Branch, MergeConflict, SnapshotStateEntry, StatusCandidate, Team } from '../types';
import { BackendProjectWithTeam } from '../vcs/normalize-backend-project-team';

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
