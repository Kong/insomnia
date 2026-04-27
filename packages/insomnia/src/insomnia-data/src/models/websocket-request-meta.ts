import type { BaseModel } from '~/models/types';

export const name = 'WebSocket Request Meta';

export const type = 'WebSocketRequestMeta';

export const prefix = 'ws-req-meta';

export const canDuplicate = false;

export const canSync = false;

interface BaseWebSocketRequestMeta {
  pinned: boolean;
}

export type WebSocketRequestMeta = BaseModel & BaseWebSocketRequestMeta;

export const isWebSocketRequestMeta = (model: Pick<BaseModel, 'type'>): model is WebSocketRequestMeta =>
  model.type === type;

export function init() {
  return {
    pinned: false,
  };
}
