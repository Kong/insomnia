import { describe, expect, it } from 'vitest';

import { RequestInfo } from '../request-info';

describe('test request info', () => {
  it('test normal request info', () => {
    const requestInfo = new RequestInfo({
      eventName: 'prerequest',
      requestName: 'request_name',
      requestId: 'req_bd8b1eb53418482585b70d0a9616a8cc',
    });
    expect(requestInfo.toObject()).toEqual({
      eventName: 'prerequest',
      requestName: 'request_name',
      requestId: 'req_bd8b1eb53418482585b70d0a9616a8cc',
      iteration: 1,
      iterationCount: 1,
    });
  });

  it('test runner request info', () => {
    const runnerRequestInfo = new RequestInfo({
      eventName: 'prerequest',
      requestName: 'request_name',
      requestId: 'req_bd8b1eb53418482585b70d0a9616a8cc',
      iteration: 3,
      iterationCount: 5,
    });
    expect(runnerRequestInfo.toObject()).toEqual({
      eventName: 'prerequest',
      requestName: 'request_name',
      requestId: 'req_bd8b1eb53418482585b70d0a9616a8cc',
      iteration: 3,
      iterationCount: 5,
    });
  });
});
