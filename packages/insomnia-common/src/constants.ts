import { ValueOf } from 'type-fest';

// HTTP version codes
export const HttpVersions = {
  V1_0: 'V1_0',
  V1_1: 'V1_1',
  V2_0: 'V2_0',
  v3: 'v3',
  default: 'default',
} as const;

export type HttpVersion = ValueOf<typeof HttpVersions>;
