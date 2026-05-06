import { strings } from '~/common/strings';
import type { BaseModel } from '~/models/types';

export const name = 'ApiSpec';

export const type = 'ApiSpec';

export const prefix = 'spc';

export const canDuplicate = true;

export const canSync = true;

export const optionalKeys = ['rulesetContent'];

export interface BaseApiSpec {
  fileName: string;
  contentType: 'json' | 'yaml';
  contents: string;
  rulesetContent?: string; // This is the content of the spectral ruleset file for linting API specs. It is stored in the DB to support cloud sync, but also written to disk for spectral to use when linting.
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
