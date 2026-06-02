import type { BaseModel } from './base-types';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'WebSocket Payload';

export const type = 'WebSocketPayload';

export const prefix = 'ws-payload';

export const canDuplicate = true;

export const canSync = true;

export interface BaseWebSocketPayload {
  name: string;
  value: string;
  mode: string;
}

export type WebSocketPayload = BaseModel & BaseWebSocketPayload & { type: typeof type };

export const isWebSocketPayload = (model: Pick<BaseModel, 'type'>): model is WebSocketPayload => model.type === type;

export const isWebSocketPayloadId = (id: string | null) => id?.startsWith(`${prefix}_`);

export const init = (): BaseWebSocketPayload => ({
  name: 'New Payload',
  value: '',
  mode: 'application/json',
});

export function rewriteReferences(payload: WebSocketPayload, idMapping: Map<string, string>): WebSocketPayload {
  return { ...payload, ...replaceIdsInFields(payload, ['value'], idMapping) };
}
