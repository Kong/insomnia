import fs from 'node:fs';
import nodePath from 'node:path';

// P1-B: audit trail for the per-plugin "Full host access" (elevated) trust lever. Every grant/revoke
// is appended as a line to `plugin-audit.log`, alongside main.log / renderer.log in the log directory,
// so the trust decisions made over a plugin's lifetime are reviewable after the fact.

/** The audit file name; lives next to main.log / renderer.log (see getLogDirectory in log.ts). */
export const PLUGIN_AUDIT_LOG_FILE = 'plugin-audit.log';

export interface PluginElevationAuditEntry {
  /** Plugin name whose elevation changed. */
  pluginName: string;
  /** New state: true = granted full host access, false = revoked (back to sandboxed). */
  elevated: boolean;
  /** OS user who made the change (best-effort; a desktop app has a single local actor). */
  user?: string;
}

/**
 * Render one audit entry as a single log line. Pure (timestamp is passed in) so it's deterministic to
 * test. Values are quoted/escaped enough that a plugin name can't forge extra fields or line breaks.
 */
export const formatPluginAuditLine = (entry: PluginElevationAuditEntry, isoTimestamp: string): string => {
  const safeName = JSON.stringify(String(entry.pluginName)); // quotes + escapes quotes/newlines
  const action = entry.elevated ? 'GRANTED full host access' : 'REVOKED full host access';
  const who = entry.user ? ` user=${JSON.stringify(String(entry.user))}` : '';
  return `${isoTimestamp} [plugin-trust] ${action} plugin=${safeName} elevated=${entry.elevated}${who}\n`;
};

/** Append a pre-rendered line to `plugin-audit.log` in `logDir`. Best-effort: never throws. */
export const appendPluginAuditLine = (logDir: string, line: string): void => {
  try {
    fs.appendFileSync(nodePath.join(logDir, PLUGIN_AUDIT_LOG_FILE), line);
  } catch (err) {
    // Auditing must never break the user's action; a failed write is logged, not thrown.
    console.warn('[plugin-trust] failed to write audit log entry', err);
  }
};
