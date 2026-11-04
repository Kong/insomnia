import { redactConfidentialText, redactDeep } from '~/common/network/sensitive-value-collector';

/**
 * Per-request store of the confidential values the renderer registered for a realtime connection
 * (WebSocket / Socket.IO / curl event-stream).
 *
 * The renderer renders the request and ships the confidential values alongside it, because the
 * timeline/event-log writes happen in the main process, outside any
 * SendActionRuntime/appendTimeline abstraction. Setting OFF ⇒ the renderer sends nothing ⇒
 * nothing is redacted.
 *
 * Each protocol keeps its own registry instance; `clear` must be called when the connection's
 * maps are torn down.
 */
export interface SensitiveValuesRegistry {
  /** Merges more values into the set a connection already registered. */
  register: (requestId: string, values: string[] | undefined) => void;
  /** Starts a new connection from a fresh value set. */
  reset: (requestId: string, values: string[] | undefined) => void;
  /** Redacts a single-line field (timeline entry, error message, URL). */
  redactText: (requestId: string, text: string) => string;
  /** The values registered so far, e.g. to test whether a derived credential came from them. */
  getValues: (requestId: string) => string[];
  /** Redacts an event's string leaves before it is stringified into the event log. */
  redactEvent: <T>(requestId: string, event: T) => T;
  /** Drops a connection's values; call it from the connection teardown. */
  clear: (requestId: string) => void;
}

export const createSensitiveValuesRegistry = (): SensitiveValuesRegistry => {
  const sensitiveValuesByRequestId = new Map<string, Set<string>>();

  const register = (requestId: string, values: string[] | undefined) => {
    if (!values || values.length === 0) {
      return;
    }
    let set = sensitiveValuesByRequestId.get(requestId);
    if (!set) {
      set = new Set();
      sensitiveValuesByRequestId.set(requestId, set);
    }
    for (const value of values) {
      if (value) {
        set.add(value);
      }
    }
  };

  return {
    register,
    // A new connection starts from a fresh value set: a connect that never reached its cleanup
    // leaves its values behind, and merging could neither drop those nor empty the set once the
    // setting is off.
    reset: (requestId, values) => {
      sensitiveValuesByRequestId.delete(requestId);
      register(requestId, values);
    },
    redactText: (requestId, text) => {
      const values = sensitiveValuesByRequestId.get(requestId);
      if (!values || values.size === 0) {
        return text;
      }
      return redactConfidentialText(text, [...values]);
    },
    getValues: requestId => [...(sensitiveValuesByRequestId.get(requestId) ?? [])],
    redactEvent: (requestId, event) => {
      const values = sensitiveValuesByRequestId.get(requestId);
      return values && values.size > 0 ? redactDeep(event, [...values]) : event;
    },
    clear: requestId => {
      sensitiveValuesByRequestId.delete(requestId);
    },
  };
};
