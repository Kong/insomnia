import { v4 as uuidv4 } from 'uuid';

import { CONTENT_TYPE_JSON } from '~/common/constants';

import type { BaseModel } from './base-types';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'SocketIO Payload';

export const type = 'SocketIOPayload';

export const prefix = 'socket-io-payload';

export const canDuplicate = true;

export const canSync = true;

export interface SocketIOArg {
  id: string;
  value: string;
  mode: string;
}

export interface BaseSocketIOPayload {
  args: SocketIOArg[];
  eventName?: string;
  ack?: boolean;
}

export type SocketIOPayload = BaseModel & BaseSocketIOPayload & { type: typeof type };

export const isSocketIOPayload = (model: Pick<BaseModel, 'type'>): model is SocketIOPayload => model.type === type;

export const isSocketIOPayloadId = (id: string | null) => id?.startsWith(`${prefix}_`);

export const init = (): BaseSocketIOPayload => {
  return {
    args: [{ id: uuidv4(), value: '', mode: CONTENT_TYPE_JSON }],
    eventName: '',
    ack: false,
  };
};

export function rewriteReferences(payload: SocketIOPayload, idMapping: Map<string, string>): SocketIOPayload {
  return { ...payload, ...replaceIdsInFields(payload, ['args'], idMapping) };
}
