import type { BaseModel } from '~/models/types';

export const name = 'Proto File';

export const type = 'ProtoFile';

export const prefix = 'pf';

export const canDuplicate = true;

export const canSync = true;

interface BaseProtoFile {
  name: string;
  protoText: string;
}

export type ProtoFile = BaseModel & BaseProtoFile;

export const isProtoFile = (model: Pick<BaseModel, 'type'>): model is ProtoFile => model.type === type;

export function init(): BaseProtoFile {
  return {
    name: 'New Proto File',
    protoText: '',
  };
}
