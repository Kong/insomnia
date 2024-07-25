import { vi } from 'vitest';

import type { SendRequestCallback } from '../run/insomnia';

export const mockedSendRequest = <TResp extends {status: number}>(response?: TResp) => {
  return vi.fn<SendRequestCallback<TResp>>().mockResolvedValue(response || { status: 200 } as TResp);
};

export const mockedSendRequestMultiple = <TResp>(...responses: TResp[]) => {
  let mock = vi.fn<SendRequestCallback<TResp>>();

  responses.forEach(response => {
    mock = mock.mockResolvedValueOnce(response);
  });

  return mock;
};
