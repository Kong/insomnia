import type { BaseModel } from '~/models/types';

export const name = 'CA Certificate';

export const type = 'CaCertificate';

export const prefix = 'crt';

export const canDuplicate = true;

export const canSync = false;

interface BaseCaCertificate {
  parentId: string;
  path: string | null;
  disabled: boolean;
  // For sync control
  isPrivate: boolean;
}

export type CaCertificate = BaseModel & BaseCaCertificate;

export function init(): BaseCaCertificate {
  return {
    parentId: '',
    disabled: false,
    path: null,
    isPrivate: false,
  };
}

export const isCaCertificate = (model: Pick<BaseModel, 'type'>): model is CaCertificate => model.type === type;
