import type { z } from 'zod/v4';

import type { AllTypes } from './base-types';
import * as dbModels from './db-models';
import { getEncryptedFieldPaths } from './utils/encrypted-field';

interface ModelWithEncryptedFields {
  type: string;
  schema?: z.ZodType;
  // Temporary for models that are not on Zod yet; merged into the same map
  encryptedFields?: string[];
}

let pathsByType: Record<AllTypes, string[]> | undefined;

// Built lazily, and not at module load, to avoid issues with circular dependencies
/** Encrypted field paths of every model type, derived from the `encrypted()` marks on its schema. */
export const getEncryptedFieldPathsByType = (): Record<AllTypes, string[]> => {
  if (pathsByType) {
    return pathsByType;
  }
  const result = {} as Record<AllTypes, string[]>;
  for (const model of Object.values(dbModels) as ModelWithEncryptedFields[]) {
    const paths = new Set([
      ...(model.schema ? getEncryptedFieldPaths(model.schema) : []),
      ...(model.encryptedFields ?? []),
    ]);
    result[model.type as AllTypes] = [...paths].sort();
  }
  pathsByType = result;
  return result;
};

/** Encrypted field paths of a document type; empty for types without encrypted fields and for unknown types. */
export const getEncryptedFieldPathsForType = (type: string): readonly string[] =>
  Object.hasOwn(getEncryptedFieldPathsByType(), type) ? getEncryptedFieldPathsByType()[type as AllTypes] : [];
