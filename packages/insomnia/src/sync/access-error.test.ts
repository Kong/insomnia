import { describe, expect, it } from 'vitest';

import { interceptAccessError } from './access-error';

describe('interceptAccessError', () => {
  it('intercepts an error', async () => {
    const action = async () =>
      (await interceptAccessError({
        action: 'action',
        callback: () => {
          throw new Error('DANGER! invalid access to the fifth dimensional nebulo 9.');
        },
        resourceName: 'resourceName',
        resourceType: 'resourceType',
      })) as Error;

    await expect(action).rejects.toBeInstanceOf(Error);
    await expect(action).rejects.toThrowError(
      'You no longer have permission to action the "resourceName" resourceType.  Contact your team administrator if you think this is an error.',
    );
  });

  it("does not intercept errors it doesn't care about", async () => {
    const message =
      'Having been rejected by the planet smasher, Ziltoid seeks the council of the omnidimensional creator.';

    const action = async () =>
      (await interceptAccessError({
        action: 'action',
        callback: () => {
          throw new Error(message);
        },
        resourceName: 'resourceName',
        resourceType: 'resourceType',
      })) as Error;

    await expect(action).rejects.toBeInstanceOf(Error);
    await expect(action).rejects.toThrowError(message);
  });
});
