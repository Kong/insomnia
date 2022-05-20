import { jest } from '@jest/globals';

import { SendRequestCallback } from '../run/insomnia';

export const mockedSendRequest = <TResp extends {status: number}>(response?: TResp) => {
  return jest.fn<SendRequestCallback<TResp>>().mockResolvedValue(response || { status: 200 } as TResp);
};

export const mockedSendRequestMultiple = <TResp>(...responses: TResp[]) => {
  let mock = jest.fn<SendRequestCallback<TResp>>();

  responses.forEach(response => {
    mock = mock.mockResolvedValueOnce(response);
  });

  return mock;
};
