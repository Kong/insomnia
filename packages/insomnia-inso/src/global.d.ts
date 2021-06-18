import { Database } from './db';

declare module 'insomnia-send-request' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(TSCONVERSION) missing types from insomnia-send-request
  export function getSendRequestCallbackMemDb(environmentId: string, db: Database): Promise<any>;
}

export {};
