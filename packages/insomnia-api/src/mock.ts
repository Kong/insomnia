import type * as Har from 'har-format';

import { fetch } from './fetch';

export interface MockbinLogOutput {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: [
      {
        startedDateTime: string;
        clientIPAddress: string;
        request: Har.Request;
      },
    ];
  };
}

export const fetchMockbinLogs = ({
  compoundId,
  method,
  sessionId,
}: {
  compoundId: string;
  method: string;
  sessionId: string;
}) => {
  return fetch<MockbinLogOutput>({
    method: 'GET',
    path: `/bin/log/${compoundId}`,
    headers: {
      'insomnia-mock-method': method,
    },
    sessionId,
  });
};

export const upsertMockbin = ({
  compoundId,
  organizationId,
  sessionId,
  mockbinUrl,
  method,
  data,
}: {
  mockbinUrl: string;
  compoundId: string;
  organizationId: string;
  sessionId: string;
  method: string;
  data: Har.Response;
}) => {
  return fetch({
    origin: mockbinUrl,
    path: `/bin/upsert/${compoundId}`,
    method: 'PUT',
    organizationId,
    sessionId,
    headers: {
      'insomnia-mock-method': method,
    },
    data,
  });
};
