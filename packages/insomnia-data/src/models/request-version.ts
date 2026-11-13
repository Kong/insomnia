import type { BaseModel } from './base-types';

/* When viewing a specific request, the user can click the Send button to test-send it.
Each time the user sends the request, the parameters may differ—they might edit the body, headers, and so on—and Insomnia records every sent request as history.
When the user browses the send history for a request and selects one of the entries, the current request is restored to the exact state it had when that request was sent, including the body, headers, and other settings.
A Request Version is essentially a snapshot of the request at the moment it was test-sent. */

export const name = 'Request Version';

export const type = 'RequestVersion';

export const prefix = 'rvr';

export const canDuplicate = false;

export const canSync = false;

// Temporary: replaced by an `encrypted()` field mark once this model is migrated to a Zod schema.
// `compressedRequest` is a gzip + base64 copy of the whole request, including its authentication.
export const encryptedFields = ['compressedRequest'];

interface BaseRequestVersion {
  compressedRequest: string | null;
}

export type RequestVersion = BaseModel & BaseRequestVersion;

export const isRequestVersion = (model: Pick<BaseModel, 'type'>): model is RequestVersion => model.type === type;

export function init() {
  return {
    compressedRequest: null,
  };
}
