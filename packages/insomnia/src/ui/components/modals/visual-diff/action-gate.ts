/**
 * Keeps stage / unstage / discard actions in the commit modal from overlapping. They rewrite the same
 * index entries and working files, so two in flight at once would race and whichever finished last
 * would win, eg. a single entity's Stage overwriting a "Stage this file" clicked right after it.
 */
export interface ActionGate {
  /**
   * Runs `perform` unless another action is in flight, in which case it's skipped and `undefined` is
   * returned. For actions computed from the diff on screen, which an action in flight is about to change.
   */
  tryRun<T>(perform: () => Promise<T>): Promise<T> | undefined;
  /** Runs `perform` once no other action is in flight. For actions that don't depend on the diff on screen. */
  runAfter<T>(perform: () => Promise<T>): Promise<T>;
}

export function createActionGate(onInFlightChange: (isInFlight: boolean) => void): ActionGate {
  let inFlight: Promise<unknown> | null = null;

  const start = <T>(perform: () => Promise<T>): Promise<T> => {
    onInFlightChange(true);
    const action = perform().finally(() => {
      inFlight = null;
      onInFlightChange(false);
    });
    inFlight = action;
    return action;
  };

  return {
    tryRun: perform => (inFlight ? undefined : start(perform)),
    runAfter: async perform => {
      while (inFlight) {
        // Its failure is reported by whoever started it
        await inFlight.catch(() => {});
      }
      return start(perform);
    },
  };
}
