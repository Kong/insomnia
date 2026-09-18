import path from 'node:path';

import contentDisposition from 'content-disposition';
import { describe, expect, it } from 'vitest';

import { sanitizeDownloadFilename } from '../misc';

// The "Send and Download" flow (organization...debug.request.$requestId.send.tsx) builds the
// on-disk save path as `path.join(requestMeta.downloadPath, name)`, where `name` comes straight
// from `contentDisposition.parse(header.value).parameters.filename`, a value set by whatever
// server the request was sent to. `sanitizeDownloadFilename` constrains that value to its final
// path segment before the join, so the result always stays within the directory the user
// configured as their download location.

describe('content-disposition filename used to build a download path, unconstrained', () => {
  it('lands outside the intended download directory when the header supplies a relative path', () => {
    const downloadPath = '/Users/someone/Downloads';
    const headerValue = 'attachment; filename="../../version-control/evil.json"';

    const name = contentDisposition.parse(headerValue).parameters.filename;
    const destinationPath = path.join(downloadPath, name);

    // Without constraining the name first, the resolved destination lands outside the
    // directory the user configured as their download location.
    expect(destinationPath.startsWith(downloadPath + path.sep)).toBe(false);
    expect(destinationPath).toBe('/Users/version-control/evil.json');
  });

  it('can resolve to an Insomnia userData subdirectory when the download path sits under userData', () => {
    const downloadPath = '/Users/someone/Library/Application Support/Insomnia/responses';
    const headerValue = 'attachment; filename="../../insomnia.Settings.db"';

    const name = contentDisposition.parse(headerValue).parameters.filename;
    const destinationPath = path.join(downloadPath, name);

    expect(destinationPath).toBe('/Users/someone/Library/Application Support/insomnia.Settings.db');
  });
});

describe('sanitizeDownloadFilename', () => {
  it('leaves an ordinary filename untouched', () => {
    expect(sanitizeDownloadFilename('report.json', 'fallback')).toBe('report.json');
  });

  it('constrains a POSIX-style relative path down to the final segment', () => {
    expect(sanitizeDownloadFilename('../../version-control/evil.json', 'fallback')).toBe('evil.json');
  });

  it('constrains a Windows-style relative path down to the final segment regardless of host OS', () => {
    expect(sanitizeDownloadFilename('..\\..\\insomnia.Settings.db', 'fallback')).toBe('insomnia.Settings.db');
  });

  it('constrains a leading absolute path down to the final segment', () => {
    expect(sanitizeDownloadFilename('/etc/passwd', 'fallback')).toBe('passwd');
  });

  it('falls back when the constrained name would be empty or a bare relative segment', () => {
    expect(sanitizeDownloadFilename('..', 'fallback')).toBe('fallback');
    expect(sanitizeDownloadFilename('.', 'fallback')).toBe('fallback');
    expect(sanitizeDownloadFilename('../', 'fallback')).toBe('fallback');
  });

  it('keeps a content-disposition-derived relative path inside the configured download directory once joined', () => {
    const downloadPath = '/Users/someone/Library/Application Support/Insomnia/responses';
    const headerValue = 'attachment; filename="../../insomnia.Settings.db"';
    const rawName = contentDisposition.parse(headerValue).parameters.filename;

    const destinationPath = path.join(downloadPath, sanitizeDownloadFilename(rawName, 'download'));

    expect(destinationPath).toBe(path.join(downloadPath, 'insomnia.Settings.db'));
    expect(destinationPath.startsWith(downloadPath + path.sep)).toBe(true);
  });
});
