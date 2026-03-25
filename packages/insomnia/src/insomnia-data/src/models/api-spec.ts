import { strings } from '~/common/strings';
import type { BaseModel } from '~/models/types';

export const name = 'ApiSpec';

export const type = 'ApiSpec';

export const prefix = 'spc';

export const canDuplicate = true;

export const canSync = true;

export interface BaseApiSpec {
  fileName: string;
  contentType: 'json' | 'yaml';
  contents: string;
}

export type ApiSpec = BaseModel & BaseApiSpec;

export const isApiSpec = (model: Pick<BaseModel, 'type'>): model is ApiSpec => model.type === type;

export function init(): BaseApiSpec {
  return {
    fileName: `New ${strings.document.singular}`,
    contents: '',
    contentType: 'yaml',
  };
}
