import { createBuilder, Schema } from '@develohpanda/fluent-builder';
import { baseModelSchema } from '../../models/__schemas__/base-model-schema';
import { Branch, MergeConflict, StatusCandidate } from '../types';

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
