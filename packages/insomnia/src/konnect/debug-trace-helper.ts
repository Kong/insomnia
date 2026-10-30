import type { DebugSession } from './debug-session-api';
export type DebugSessionState = 'active' | 'stopped' | 'completed' | 'expired' | 'timed_out';

// Derive the state of a debug session from its response
export function deriveSessionState(session: DebugSession, nowMs: number): DebugSessionState {
  if (session.timedOut) {
    return 'timed_out';
  }
  if (session.stoppedAt) {
    return 'stopped';
  }
  if (session.completedAt) {
    return 'completed';
  }
  if (session.startedAt) {
    const endsAt = new Date(session.startedAt).getTime() + session.durationSecs * 1000;
    if (Number.isFinite(endsAt) && nowMs >= endsAt) {
      return 'expired';
    }
  }
  return 'active';
}

export function getSessionEndsAt(session: DebugSession): number | null {
  if (!session.startedAt) {
    return null;
  }
  const endsAt = new Date(session.startedAt).getTime() + session.durationSecs * 1000;
  return Number.isFinite(endsAt) ? endsAt : null;
}
