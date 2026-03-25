import { getMockServiceURL } from '~/common/constants';

import type { BaseModel } from './base-types';

export const name = 'Mock Server';

export const type = 'MockServer';

export const prefix = 'mock';

export const canDuplicate = true;

export const canSync = true;

interface BaseMockServer {
  parentId: string;
  name: string;
  url: string;
  useInsomniaCloud: boolean;
}

export type MockServer = BaseModel & BaseMockServer;

export function init(): BaseMockServer {
  return {
    parentId: '',
    name: 'New Mock',
    url: 'http://localhost:8080',
    useInsomniaCloud: true,
  };
}

export const isMockServer = (model: Pick<BaseModel, 'type'>): model is MockServer => model.type === type;

export const getMockServiceBinURL = (mockServer: MockServer, path: string) => {
  if (!mockServer.useInsomniaCloud) {
    return `${mockServer.url}/bin/${mockServer._id}${path}`;
  }
  const baseUrl = getMockServiceURL();
  const url = new URL(baseUrl);
  url.host = mockServer._id.replace('_', '-') + '.' + url.host;
  return url.origin + path;
};
