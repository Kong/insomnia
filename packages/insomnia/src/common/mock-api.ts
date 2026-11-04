import type * as Har from 'har-format';

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

const requestMockServer = async (url: string, init: RequestInit) => {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Mock server responded with ${response.status}`);
  }
  return response;
};

export const fetchMockbinLogs = async ({
  compoundId,
  method,
  mockbinUrl,
}: {
  compoundId: string;
  method: string;
  mockbinUrl: string;
}) => {
  const response = await requestMockServer(`${mockbinUrl}/bin/log/${compoundId}`, {
    headers: { 'insomnia-mock-method': method },
  });
  return (await response.json()) as MockbinLogOutput;
};

export const upsertMockbin = async ({
  compoundId,
  mockbinUrl,
  method,
  data,
}: {
  mockbinUrl: string;
  compoundId: string;
  method: string;
  data: Har.Response;
}) => {
  const response = await requestMockServer(`${mockbinUrl}/bin/upsert/${compoundId}`, {
    method: 'PUT',
    headers: { 'insomnia-mock-method': method, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.text();
};
