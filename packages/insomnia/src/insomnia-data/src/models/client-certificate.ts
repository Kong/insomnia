import type { BaseModel } from './base-types';

export const name = 'Client Certificate';

export const type = 'ClientCertificate';

export const prefix = 'crt';

export const canDuplicate = true;

export const canSync = false;

interface BaseClientCertificate {
  parentId: string;
  host: string;
  passphrase: string | null;
  cert: string | null;
  key: string | null;
  pfx: string | null;
  disabled: boolean;
  // For sync control
  isPrivate: boolean;
}

export type ClientCertificate = BaseModel & BaseClientCertificate;

export function init(): BaseClientCertificate {
  return {
    parentId: '',
    host: '',
    passphrase: null,
    disabled: false,
    cert: null,
    key: null,
    pfx: null,
    isPrivate: false,
  };
}

export const isClientCertificate = (model: Pick<BaseModel, 'type'>): model is ClientCertificate => model.type === type;
