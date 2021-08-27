import { mocked } from 'ts-jest/utils';

import { SendRequestCallback } from '../run/insomnia';

export const mockedSendRequest = <TResp extends {status: number}>(response?: TResp) => {
  return mocked<SendRequestCallback<TResp>>(jest.fn()).mockResolvedValue(response || { status: 200 } as TResp);
};

export const mockedSendRequestMultiple = <TResp>(...responses: TResp[]) => {
  let mock = mocked<SendRequestCallback<TResp>>(jest.fn());

  responses.forEach(response => {
    mock = mock.mockResolvedValueOnce(response);
  });

  return mock;
};
