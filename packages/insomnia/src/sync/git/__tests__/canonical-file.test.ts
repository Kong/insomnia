import fs from 'node:fs';
import path from 'node:path';

import { models } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { database as db } from '../../../common/database';
import { migrateToLatestYaml } from '../../../common/insomnia-schema-migrations';
import { getInsomniaV5DataExport, tryImportV5Data } from '../../../common/insomnia-v5';
import { getCanonicalInsomniaFileContent, isUndiscardableChange } from '../canonical-file';

const FIXTURE_DIR = path.join(__dirname, '..', '..', '..', 'common', '__fixtures__', 'insomnia-v5-roundtrip');
// Skip fixtures that are raw OpenAPI documents rather than Insomnia files
const insomniaFixtures = fs
  .readdirSync(FIXTURE_DIR)
  .filter(file => file.endsWith('.yaml'))
  .filter(file => /^type: .*insomnia/.test(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8')));

/** Runs `content` through the real pipeline: the RepoFileWatcher import (db.update per doc) followed by the export. */
async function exportThroughDatabase(content: string) {
  const { data, error } = tryImportV5Data(content);
  expect(error).toBeUndefined();
  for (const doc of data) {
    await db.update(doc);
  }
  const workspace = data.find(models.workspace.isWorkspace);
  expect(workspace).toBeDefined();
  return getInsomniaV5DataExport({ workspaceId: workspace!._id, includePrivateEnvironments: false });
}

const buildCollection = (folders: { id: string; name: string; created: number }[]) => `type: collection.insomnia.rest/5.0
name: Test Collection
meta:
  id: wrk_test
  created: 1000
  modified: 1000
collection:
${folders
  .map(
    folder => `  - name: ${folder.name}
    meta:
      id: ${folder.id}
      created: ${folder.created}
      modified: ${folder.created}
    children:
      - url: https://example.com/${folder.id}
        name: Request in ${folder.name}
        meta:
          id: req_${folder.id}
          created: 5000
          modified: 5000
        method: GET
        headers:
          - name: X-Folder
            value: ${folder.id}`,
  )
  .join('\n')}
cookieJar:
  name: Default Jar
  meta:
    id: jar_test
    created: 1000
    modified: 1000
environments:
  name: Base Environment
  meta:
    id: env_test
    created: 1000
    modified: 1000
`;

// Folder B is listed first but was created after Folder A, as if someone reordered the file by hand
const reorderedCollection = buildCollection([
  { id: 'fld_b', name: 'Folder B', created: 3000 },
  { id: 'fld_a', name: 'Folder A', created: 2000 },
]);

describe('canonical-file', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  describe('getCanonicalInsomniaFileContent', () => {
    it.each(insomniaFixtures)(
      'matches the real import/export pipeline for %s',
      async fixture => {
        const content = fs.readFileSync(path.join(FIXTURE_DIR, fixture), 'utf8');
        const canonicalContent = await getCanonicalInsomniaFileContent(content);
        expect(canonicalContent).toBe(await exportThroughDatabase(content));
      },
    );

    it('matches the real pipeline when siblings share the same created time', async () => {
      const content = buildCollection([
        { id: 'fld_c', name: 'Folder C', created: 2000 },
        { id: 'fld_a', name: 'Folder A', created: 2000 },
        { id: 'fld_b', name: 'Folder B', created: 2000 },
      ]);
      const canonicalContent = await getCanonicalInsomniaFileContent(content);
      expect(canonicalContent).toBe(await exportThroughDatabase(content));
      expect(canonicalContent!.indexOf('Folder A')).toBeLessThan(canonicalContent!.indexOf('Folder B'));
      expect(canonicalContent!.indexOf('Folder B')).toBeLessThan(canonicalContent!.indexOf('Folder C'));
    });

    it('reorders siblings by created time like the real pipeline', async () => {
      const canonicalContent = await getCanonicalInsomniaFileContent(reorderedCollection);
      expect(canonicalContent).toBe(await exportThroughDatabase(reorderedCollection));
      expect(canonicalContent!.indexOf('Folder A')).toBeLessThan(canonicalContent!.indexOf('Folder B'));
    });

    it('is stable for content Insomnia generated itself', async () => {
      const canonicalContent = await getCanonicalInsomniaFileContent(reorderedCollection);
      expect(await getCanonicalInsomniaFileContent(canonicalContent!)).toBe(canonicalContent);
    });

    it('returns null for files that are not Insomnia files', async () => {
      expect(await getCanonicalInsomniaFileContent('openapi: 3.0.0\ninfo:\n  title: Spec\n')).toBeNull();
    });

    it('returns null for Insomnia files that cannot be imported', async () => {
      expect(await getCanonicalInsomniaFileContent('type: collection.insomnia.rest/5.0\nname: [\n')).toBeNull();
    });
  });

  describe('isUndiscardableChange', () => {
    it('detects a change that only comes from Insomnia re-generating the committed file', async () => {
      const workingCopyContent = await exportThroughDatabase(reorderedCollection);
      expect(workingCopyContent).not.toBe(reorderedCollection);

      expect(await isUndiscardableChange({ committedContent: reorderedCollection, workingCopyContent })).toBe(true);
    });

    it('detects an old-schema file that the diff view normalizes to look identical to the working copy', async () => {
      const workingCopyContent = await exportThroughDatabase(reorderedCollection);
      // A schema 5.0 file: no schema_version, header ids, and folders in hand-edited order
      const oldSchemaFile = YAML.parse(workingCopyContent);
      delete oldSchemaFile.schema_version;
      oldSchemaFile.collection.reverse();
      oldSchemaFile.collection[0].children[0].headers[0].id = 'pair_1';
      const committedContent = YAML.stringify(oldSchemaFile);

      // The diff view migrates and reorders the committed side against the working copy, hiding the change
      expect(migrateToLatestYaml(committedContent, workingCopyContent)).toBe(workingCopyContent);

      expect(await isUndiscardableChange({ committedContent, workingCopyContent })).toBe(true);
    });

    it('does not flag a change that mixes a real edit with the re-generated format', async () => {
      const workingCopyContent = (await exportThroughDatabase(reorderedCollection)).replace(
        'https://example.com/fld_a',
        'https://example.com/edited',
      );

      expect(await isUndiscardableChange({ committedContent: reorderedCollection, workingCopyContent })).toBe(false);
    });

    it('does not flag a real edit to a file in the canonical format', async () => {
      const committedContent = await exportThroughDatabase(reorderedCollection);
      const workingCopyContent = committedContent.replace('https://example.com/fld_a', 'https://example.com/edited');

      expect(await isUndiscardableChange({ committedContent, workingCopyContent })).toBe(false);
    });

    it('does not flag new or deleted files', async () => {
      expect(await isUndiscardableChange({ committedContent: null, workingCopyContent: reorderedCollection })).toBe(
        false,
      );
      expect(await isUndiscardableChange({ committedContent: reorderedCollection, workingCopyContent: null })).toBe(
        false,
      );
    });
  });
});
