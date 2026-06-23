import type { BaseModel } from './base-types';
import type { EnvironmentKvPairData, EnvironmentType } from './environment';
import type { RequestAuthentication, RequestHeader } from './request';
import { replaceIdsInFields } from './utils/replace-ids-in-fields';

export const name = 'Folder';

export const type = 'RequestGroup';

export const prefix = 'fld';

export const canDuplicate = true;

export const canSync = true;
// for those keys do not need to add in model init method
export const optionalKeys: (keyof BaseRequestGroup)[] = [
  'kvPairData',
  'environmentType',
  'konnectRouteId',
  'environmentPropertyOrder',
];
interface BaseRequestGroup {
  name: string;
  description: string;
  environment: Record<string, any>;
  environmentPropertyOrder?: Record<string, any> | null;
  kvPairData?: EnvironmentKvPairData[];
  environmentType?: EnvironmentType;
  metaSortKey: number;
  preRequestScript?: string;
  afterResponseScript?: string;
  authentication?: RequestAuthentication | {};
  headers?: RequestHeader[];
  konnectRouteId?: string | null;
}

export type RequestGroup = BaseModel & BaseRequestGroup;

export const isRequestGroup = (model: Pick<BaseModel, 'type'>): model is RequestGroup => model.type === type;
export const isRequestGroupId = (id?: string | null) => id?.startsWith(prefix);

export function init(): BaseRequestGroup {
  return {
    name: 'New Folder',
    description: '',
    environment: {},
    metaSortKey: -1 * Date.now(),
    preRequestScript: undefined,
    afterResponseScript: undefined,
    authentication: undefined,
    headers: undefined,
  };
}

export function rewriteReferences(group: RequestGroup, idMapping: Map<string, string>): RequestGroup {
  return {
    ...group,
    ...replaceIdsInFields(
      group,
      ['authentication', 'headers', 'preRequestScript', 'afterResponseScript', 'environment', 'kvPairData'],
      idMapping,
    ),
    konnectRouteId: null,
  };
}
