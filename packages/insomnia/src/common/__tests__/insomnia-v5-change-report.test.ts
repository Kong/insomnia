import { describe, expect, it } from 'vitest';

import { buildInsomniaChangeReport } from '../insomnia-v5-change-report';

const folderBlock = `  - name: My Folder
    meta:
      id: fld_14bd9a6ed9054108af3886087c32c546
      created: 1788404350295
      modified: 1788404350295
      sortKey: -1788404350295
      description: ""
    children:
      - url: ""
        name: Request in folder
        meta:
          id: req_d5f4666558964d5fbe2d110018c0f643
          created: 1788404365468
          modified: 1788404378369
          isPrivate: false
          description: ""
          sortKey: -1788404365468
        method: GET
`;

const requestBlock = (url = '', modified = 1_788_404_354_782) => `  - url: "${url}"
    name: New Request
    meta:
      id: req_fa97ee0857f34db89d214438d5ac9755
      created: 1788404354782
      modified: ${modified}
      isPrivate: false
      description: ""
      sortKey: -1788404354782
    method: GET
`;

const file = (collection: string) => `type: collection.insomnia.rest/5.0
name: My Collection
meta:
  id: wrk_6d1aa0becd154ea28352f43614d2c2f6
  created: 1788404339785
  modified: 1788404339785
  description: ""
collection:
${collection}environments:
  name: Base Environment
  meta:
    id: env_8fbc3c275b44fff9427729aeb0b419dab976e373
    created: 1788404339791
    modified: 1788404339791
    isPrivate: false
`;

// What Insomnia 11.5 wrote: folders before requests.
const committed = file(folderBlock + requestBlock());
// What 11.6+ writes from the same data: requests before folders.
const reordered = file(requestBlock() + folderBlock);

describe('buildInsomniaChangeReport', () => {
  it('reports a pure sibling reorder as order-only', () => {
    const report = buildInsomniaChangeReport(committed, reordered);

    expect(report.verdict).toBe('order-only');
    expect(report.contentChanged).toEqual([]);
    expect(report.added).toEqual([]);
    expect(report.removed).toEqual([]);
    expect(report.moved).toEqual([]);
    expect(report.reordered.map(entry => [entry.name, entry.fromIndex, entry.toIndex])).toEqual([
      ['New Request', 1, 0],
      ['My Folder', 0, 1],
    ]);
  });

  it('reports an edited field without listing the reorder as content', () => {
    const report = buildInsomniaChangeReport(committed, file(requestBlock('https://example.com') + folderBlock));

    expect(report.verdict).toBe('content-changed');
    expect(report.contentChanged).toHaveLength(1);
    expect(report.contentChanged[0].name).toBe('New Request');
    expect(report.contentChanged[0].fields).toEqual([
      { field: 'url', before: '', after: 'https://example.com', isMetadata: false },
    ]);
    expect(report.reordered).toHaveLength(2);
  });

  it('separates Insomnia-managed metadata from real edits', () => {
    const report = buildInsomniaChangeReport(committed, file(folderBlock + requestBlock('', 1_788_999_999_999)));

    expect(report.verdict).toBe('metadata-only');
    expect(report.contentChanged).toEqual([]);
    expect(report.metadataChanged).toHaveLength(1);
    expect(report.metadataChanged[0].fields.map(field => field.field)).toEqual(['meta.modified']);
  });

  it('detects an entry moving into a different parent', () => {
    const movedIntoFolder = file(`  - name: My Folder
    meta:
      id: fld_14bd9a6ed9054108af3886087c32c546
      created: 1788404350295
      modified: 1788404350295
      sortKey: -1788404350295
      description: ""
    children:
      - url: ""
        name: Request in folder
        meta:
          id: req_d5f4666558964d5fbe2d110018c0f643
          created: 1788404365468
          modified: 1788404378369
          isPrivate: false
          description: ""
          sortKey: -1788404365468
        method: GET
${requestBlock()
  .split('\n')
  .map(line => (line ? `    ${line}` : line))
  .join('\n')}`);

    const report = buildInsomniaChangeReport(committed, movedIntoFolder);

    expect(report.verdict).toBe('content-changed');
    expect(report.moved.map(entry => entry.name)).toEqual(['New Request']);
  });

  it('flags identical files', () => {
    expect(buildInsomniaChangeReport(committed, committed).verdict).toBe('identical');
  });

  it('surfaces a parse failure instead of throwing', () => {
    const report = buildInsomniaChangeReport(committed, 'invalid: yaml: content: [unclosed');

    expect(report.verdict).toBe('unparsable');
    expect(report.parseErrors[0].side).toBe('local');
  });
});
