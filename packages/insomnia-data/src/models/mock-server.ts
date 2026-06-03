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
