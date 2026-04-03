import type { RequestHeader } from '~/models/request';
import type { BaseModel } from '~/models/types';

export const name = 'Mock Route';

export const type = 'MockRoute';

export const prefix = 'mock-route';

export const canDuplicate = true;

export const canSync = true;

interface BaseMockRoute {
  body: string;
  headers: RequestHeader[];
  parentId: string;
  statusCode: number;
  statusText: string;
  name: string;
  mimeType: string; // response body type
  method: string; // used only for sending the testing request
}

export type MockRoute = BaseModel & BaseMockRoute;

export function init(): BaseMockRoute {
  return {
    body: '',
    headers: [],
    parentId: '',
    statusCode: 200,
    statusText: '',
    name: '/',
    mimeType: 'application/json',
    method: 'GET',
  };
}

export const isMockRoute = (model: Pick<BaseModel, 'type'>): model is MockRoute => model.type === type;
