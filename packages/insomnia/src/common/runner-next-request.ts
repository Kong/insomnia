export interface RunnerRequestRef {
  id: string;
  name: string;
}

/**
 * Finds the request that `insomnia.execution.setNextRequest()` points to.
 *
 * The whole run list is searched, so a script can jump backwards as well as forwards.
 * An id match wins over a name match, and when several requests share the name the last one is used.
 * Returns -1 when nothing matches, which ends the current iteration.
 */
export const findNextRequestIndex = (requests: RunnerRequestRef[], nextRequestIdOrName: string): number => {
  const target = nextRequestIdOrName.trim();
  if (!target) {
    return -1;
  }

  const idIndex = requests.findIndex(req => req.id.trim() === target);
  if (idIndex !== -1) {
    return idIndex;
  }

  return requests.findLastIndex(req => req.name.trim() === target);
};
