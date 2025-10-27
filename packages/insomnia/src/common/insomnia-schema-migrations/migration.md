# Insomnia Schema Migration Guide

## Overview

This document explains how schema migrations work in the Insomnia codebase, how to add new migrations, and best practices for maintaining schema versioning. It is intended for contributors and maintainers working with data model changes, especially when breaking changes are introduced.

---

## How the migration works

- **Schema migrations** ensure that data exported from or imported into Insomnia is always compatible with the current application version.
- Each Insomnia data file (YAML) uses a **versioning approach**:
  - `schema_version` field indicates the actual schema version (e.g., `5.1`) for features
- When importing data, the application detects the file's schema version and applies all necessary migrations to bring it up to the latest version.
- Migrations are defined as a sequence of transformation functions, each responsible for upgrading data from one version to the next.
- The current schema version is defined in a single source of truth:  
  `src/common/insomnia-schema-migrations/schema-version.ts`

  ```typescript
  export const INSOMNIA_SCHEMA_VERSION = '5.1';
  ```

### Schema Versioning Strategy

- **Backward Compatibility**: Old versions can read new data files (they ignore the `schema_version` field)
- **Forward Compatibility**: New versions can read old data files (they migrate them automatically)
- **No Breaking Changes**: The `type` field remains stable across versions
- **Clear Feature Versioning**: The `schema_version` field indicates which features are available

**Example:**

```yaml
# v5.0 (Original)
type: "collection.insomnia.rest/5.0"
name: "My Collection"
collection:
  - name: "My Request"
    headers:
      - name: "Content-Type"
        value: "application/json"
        id: "header_123"  # This will be removed in v5.1
# ... rest of data

# v5.1 (New features, same type)
type: "collection.insomnia.rest/5.0"  # SAME for compatibility
schema_version: "5.1"                 # NEW for features
name: "My Collection"
collection:
  - name: "My Request"
    headers:
      - name: "Content-Type"
        value: "application/json"
        # id field removed in v5.1
# ... rest of data with v5.1 features
```

---

## Folder Structure

```text
src/common/
  ├── insomnia-schema-migrations/
  │     ├── index.ts                   # Migration registry and logic
  │     ├── schema-version.ts          # Defines INSOMNIA_SCHEMA_VERSION
  │     ├── v5.1.ts                    # Migration function for 5.1
  │     ├── v5.x.ts                    # Migration function for 5.2 (example)
  │     └── migration.md               # This documentation file
  ├── import-v5-parser.ts              # Zod schemas with dual versioning
  └── ... (other files)
```

---

## Key Files

- **schema-version.ts**  
  Holds the current schema version constant (`INSOMNIA_SCHEMA_VERSION = '5.x'`).
  This is the single source of truth for the current schema version.

- **insomnia-schema-migrations/index.ts**

  - Contains the migration registry (`migrations` array) with all available migrations
  - Imports migration functions from versioned files (e.g., `v5.1.ts`, `v5.2.ts`)
  - Exports migration utilities: `migrateToLatestYaml()`
  - Handles version detection and applies only necessary migrations
  - Optimized to avoid unnecessary processing when data is already at the latest version

- **insomnia-schema-migrations/v5.x.ts**

  - Each file contains the migration function for a specific version (e.g., `v5.1.ts` for version 5.1)
  - Current implementation: `v5.1.ts` contains `cleanHeadersAndParameters()` function

- **import-v5-parser.ts**  
  Contains Zod schemas with dual versioning support:
  - `type` field: Always `collection.insomnia.rest/5.0` (for backward compatibility)
  - `schema_version` field: Current version (e.g., `5.1`) with default fallback
  - Supports all Insomnia file types: Collection, ApiSpec, MockServer, GlobalEnvironments

---

## How to Add a New Migration

1. **Update the Schema Version**

   - Bump the version in `schema-version.ts` (e.g., from `'5.1'` to `'5.2'`).

2. **Create a Migration File**

   - Create a new file in `insomnia-schema-migrations/` named after the new version, e.g., `v5.2.ts`.
   - Write your migration function in this file:

   ```typescript
   // filepath: src/common/insomnia-schema-migrations/v5.2.ts
   export function migrateTo52(data: any): any {
     // Update schema_version field, NOT the type field
     if (data.type && data.type.includes('/5.0')) {
       data.schema_version = '5.2';
     }

     // ...your migration logic here...
     return data;
   }
   ```

3. **Register the Migration**

   - In `insomnia-schema-migrations/index.ts`, import your migration function and add it to the `migrations` array:

   ```typescript
   import { migrateTo52 } from './v5.2';

   const migrations: Migration<any>[] = [
     // ...existing migrations
     {
       version: '5.2',
       up: migrateTo52,
     },
   ];
   ```

4. **Update Zod Schemas (if needed)**

   - If the schema structure changes, update the Zod schemas in `import-v5-parser.ts` to reflect the new structure.
   - Remember: Keep `type` field as `collection.insomnia.rest/5.0` for backward compatibility.
   - Update `schema_version` default to the new version.

5. **Test the Migration**
   - Add or update tests to ensure that data from previous versions is correctly migrated to the new version.
   - Test importing/exporting data and running migrations on real-world files.
   - Verify backward compatibility with older Insomnia versions.

## Example Migration Function

```typescript
// filepath: src/common/insomnia-schema-migrations/v5.1.ts
export function cleanHeadersAndParameters(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanHeadersAndParameters(item));
  }

  // ...migration code.

  return obj;
}
```

And in your migration registry:

```typescript
// filepath: src/common/insomnia-schema-migrations/index.ts
import { cleanHeadersAndParameters } from './v5.1';

const migrations: Migration<any>[] = [
  {
    version: '5.1',
    up: cleanHeadersAndParameters,
  },
  // ...future migrations
];
```

## Zod Schema Example

```typescript
// filepath: src/common/import-v5-parser.ts
export const CollectionSchema = z.object({
  type: z.literal('collection.insomnia.rest/5.0'), // Always 5.0 for compatibility
  schema_version: z.string().optional().default(INSOMNIA_SCHEMA_VERSION), // Current version
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  collection: RequestCollectionSchema.optional(),
  cookieJar: CookieJarSchema.optional(),
  environments: EnvironmentSchema.optional(),
  certificates: z.array(CACertificateSchema).optional(),
});
```

## Migration Usage in Codebase

The migration system is used in several key places:

1. **Git Operations** (`git-vcs.ts`):

   - Applied to HEAD and STAGE blobs during diff operations
   - Ensures migrated data is displayed correctly in diff views

2. **Git Service** (`git-service.ts`):

   - Applied during repository cloning operations
   - Ensures imported data is compatible with current schema

3. **Merge Conflicts** (`sync-merge-modal.tsx`):

   - Applied to merge results before validation
   - Ensures merged data follows current schema

4. **Data Import** (`insomnia-v5.ts`):
   - Applied during data import operations
   - Ensures all imported data is migrated to latest version

---

## When to Update the Schema Version

- When adding, removing, or renaming fields
- When changing the type or structure of existing fields
- When introducing new required fields or validation rules

---

## Migration Performance

The migration system is optimized for performance:

- **Early exit**: If data is already at the latest version, no processing is done
- **Selective application**: Only migrations needed for the detected version are applied
- **Error handling**: Migration failures fall back to original content
- **Minimal processing**: Migrations are only applied when necessary

---

## Summary

- Use `INSOMNIA_SCHEMA_VERSION` as the single source of truth
- Place each migration in its own file (e.g., `v5.2.ts`) and import it in the migration registry (`index.ts`)
- Always migrate imported data to the latest schema before using it
- Keep the `type` field stable at `collection.insomnia.rest/5.0` for backward compatibility
- Use the `schema_version` field to indicate the actual schema version and features
- Test both forward and backward compatibility scenarios

---
