import type { BaseModel } from '~/models/types';

export const name = 'Socket.IO Request Meta';

export const type = 'SocketIORequestMeta';

export const prefix = 'socketio-req-meta';

export const canDuplicate = false;

export const canSync = false;

interface BaseSocketIORequestMeta {
  pinned: boolean;
}

export type SocketIORequestMeta = BaseModel & BaseSocketIORequestMeta;

export const isSocketIORequestMeta = (model: Pick<BaseModel, 'type'>): model is SocketIORequestMeta =>
  model.type === type;

export function init() {
  return {
    pinned: false,
  };
}
