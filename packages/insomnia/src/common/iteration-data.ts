import type { UserUploadEnvironment } from 'insomnia-data';

/**
 * Pick the data file row for an iteration, cycling through the rows in order.
 * @param list rows parsed from the uploaded CSV or JSON file
 * @param currentIteration zero-based iteration index
 */
export const wrapAroundIterationOverIterationData = (
  list?: UserUploadEnvironment[],
  currentIteration?: number,
): UserUploadEnvironment | undefined => {
  if (currentIteration === undefined || !Array.isArray(list) || list.length === 0) {
    return undefined;
  }
  return list[currentIteration % list.length];
};
