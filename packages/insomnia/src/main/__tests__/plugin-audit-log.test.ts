import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { appendPluginAuditLine, formatPluginAuditLine, PLUGIN_AUDIT_LOG_FILE } from '../plugin-audit-log';

describe('formatPluginAuditLine', () => {
  const ts = '2026-08-07T12:00:00.000Z';

  it('renders a grant with timestamp, action, plugin, and user', () => {
    const line = formatPluginAuditLine({ pluginName: 'insomnia-plugin-x', elevated: true, user: 'alice' }, ts);
    expect(line).toBe(
      `2026-08-07T12:00:00.000Z [plugin-trust] GRANTED full host access plugin="insomnia-plugin-x" elevated=true user="alice"\n`,
    );
  });

  it('renders a revoke, and omits user when absent', () => {
    const line = formatPluginAuditLine({ pluginName: 'insomnia-plugin-x', elevated: false }, ts);
    expect(line).toBe(
      `2026-08-07T12:00:00.000Z [plugin-trust] REVOKED full host access plugin="insomnia-plugin-x" elevated=false\n`,
    );
    expect(line.endsWith('\n')).toBe(true);
  });

  it('escapes a hostile plugin name so it cannot forge fields or line breaks', () => {
    const line = formatPluginAuditLine(
      { pluginName: 'evil"\nGRANTED full host access plugin="root', elevated: true },
      ts,
    );
    // The injected newline/quotes are escaped inside the JSON-quoted value — exactly one real line.
    expect(line.split('\n').filter(Boolean)).toHaveLength(1);
    expect(line).toContain('\\n');
  });
});

describe('appendPluginAuditLine', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.forEach(d => fs.rmSync(d, { recursive: true, force: true })));

  it('appends lines to plugin-audit.log in the given dir (creating on first write)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-audit-'));
    dirs.push(dir);
    appendPluginAuditLine(dir, 'line-1\n');
    appendPluginAuditLine(dir, 'line-2\n');
    const contents = fs.readFileSync(path.join(dir, PLUGIN_AUDIT_LOG_FILE), 'utf8');
    expect(contents).toBe('line-1\nline-2\n');
  });

  it('never throws when the directory does not exist', () => {
    expect(() =>
      appendPluginAuditLine(path.join(os.tmpdir(), 'insomnia-audit-does-not-exist-xyz'), 'x\n'),
    ).not.toThrow();
  });
});
