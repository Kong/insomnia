import { models } from 'insomnia-data';
import { z } from 'zod/v4';

import { getStrictSchema } from './check-schema-mismatch';
import { findUnknownFieldRanges, type UnknownFieldRange } from './find-unknown-field-ranges';

export type SchemaCompatibility =
  // Passes the schema.
  | 'match'
  // Passes the strict schema.
  | 'strict-match'
  // Passes the schema but fails the strict schema (contains unknown fields).
  | 'match-with-unknown-fields'
  // Fails even the schema: a field is missing, renamed or has a value/format this schema doesn't accept.
  | 'mismatch';

// Memoized so getStrictSchema's WeakMap cache keeps hitting instead of rebuilding the strict schema on every call.
const modelSchemaCache = new Map<string, z.ZodTypeAny>();

function getModelSchema(type: unknown): z.ZodTypeAny | undefined {
  if (typeof type !== 'string') {
    return undefined;
  }
  const cachedSchema = modelSchemaCache.get(type);
  if (cachedSchema) {
    return cachedSchema;
  }
  const model = models.getModel(type);
  // Models that haven't been migrated to zod don't export a schema and are never checked.
  if (!model || !('schema' in model)) {
    return undefined;
  }
  // Cloud sync deletes DELETE_KEY (`modified`) from a doc before storing its blob. Make it optional to avoid a false mismatch.
  const schema = model.schema as unknown as z.ZodObject;
  let docSchema = schema.partial({ [models.DELETE_KEY]: true });
  // hashDocument also resets a Workspace's `parentId` to null (resetKeys in insomnia-data), the schema expects a string.
  if (type === models.workspace.type) {
    docSchema = docSchema.extend({ parentId: z.string().nullable() });
  }
  modelSchemaCache.set(type, docSchema);
  return docSchema;
}

function parseDoc(json?: string): Record<string, unknown> | null {
  if (!json) {
    return null;
  }
  try {
    const doc = JSON.parse(json);
    return doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : null;
  } catch {
    return null;
  }
}

export function getDocSchemaCompatibility(schema: z.ZodTypeAny, doc: unknown): SchemaCompatibility {
  if (schema.safeParse(doc).success) {
    if (getStrictSchema(schema).safeParse(doc).success) {
      return 'strict-match';
    }
    return 'match-with-unknown-fields';
  }
  return 'mismatch';
}
// Blobs are content-addressed and status is recomputed on every DB change, so remember results per blob content.
const MAX_CACHED_RESULTS = 200;
// A Map iterates in insertion order, so the first key is always the least recently used one.
const docBlobStatusCache = new Map<string, SchemaCompatibility>();

export function checkDocCompatibilityFromSchema(blobContent?: string): SchemaCompatibility {
  if (!blobContent) {
    return 'strict-match';
  }
  const cached = docBlobStatusCache.get(blobContent);
  if (cached !== undefined) {
    // Re-insert to mark it as most recently used
    docBlobStatusCache.delete(blobContent);
    docBlobStatusCache.set(blobContent, cached);
    return cached;
  }

  const doc = parseDoc(blobContent);
  const schema = doc && getModelSchema(doc.type);
  const result: SchemaCompatibility = schema ? getDocSchemaCompatibility(schema, doc) : 'strict-match';

  if (docBlobStatusCache.size >= MAX_CACHED_RESULTS) {
    docBlobStatusCache.delete(docBlobStatusCache.keys().next().value!);
  }
  docBlobStatusCache.set(blobContent, result);
  return result;
}

// Lines of the YAML rendering of a synced doc that hold unknown fields.
export function findDocUnknownFieldRanges(blobContent: string | undefined, yamlText: string): UnknownFieldRange[] {
  if (checkDocCompatibilityFromSchema(blobContent) !== 'match-with-unknown-fields') {
    return [];
  }
  const schema = getModelSchema(parseDoc(blobContent)?.type);
  return schema ? findUnknownFieldRanges(yamlText, schema) : [];
}
