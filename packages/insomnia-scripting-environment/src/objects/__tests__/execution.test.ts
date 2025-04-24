import { describe, expect, it } from 'vitest';

import { Execution } from '../execution';

describe('test execution object', () => {
  it('test location property', () => {
    const location = ['project', 'workspace', 'file', 'requestname'];
    const executionInstance = new Execution({ location });

    expect(executionInstance.location).toStrictEqual(['project', 'workspace', 'file', 'requestname']);
    // @ts-expect-error location should have current property by design
    expect(executionInstance.location.current).toEqual(location[location.length - 1]);
    expect(executionInstance.toObject()).toEqual({
      location: ['project', 'workspace', 'file', 'requestname'],
      skipRequest: false,
      nextRequestIdOrName: '',
    });
  });

  it('test skipRequest and set nextRequest', () => {
    const location = ['project', 'workspace', 'file', 'requestname'];
    const executionInstance = new Execution({ location });
    executionInstance.skipRequest();
    executionInstance.setNextRequest('nextRequestNameOrId');

    expect(executionInstance.toObject()).toEqual({
      location: ['project', 'workspace', 'file', 'requestname'],
      skipRequest: true,
      nextRequestIdOrName: 'nextRequestNameOrId',
    });
  });

  it('set invalid location', () => {
    // @ts-expect-error test invalid input
    expect(() => new Execution({ location: 'invalid' })).toThrowError();
  });
});
