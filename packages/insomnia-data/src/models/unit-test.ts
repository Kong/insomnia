import type { BaseModel } from './base-types';

export const name = 'Unit Test';

export const type = 'UnitTest';

export const prefix = 'ut';

export const canDuplicate = true;

export const canSync = true;

interface BaseUnitTest {
  name: string;
  code: string;
  requestId: string | null;
  metaSortKey: number;
}

export type UnitTest = BaseModel & BaseUnitTest;

export const isUnitTest = (model: Pick<BaseModel, 'type'>): model is UnitTest => model.type === type;

export function init() {
  return {
    requestId: null,
    name: 'My Test',
    code: '',
    metaSortKey: -1 * Date.now(),
  };
}

export function rewriteReferences(doc: UnitTest, idMapping: Map<string, string>): UnitTest {
  return {
    ...doc,
    requestId: doc.requestId ? (idMapping.get(doc.requestId) ?? doc.requestId) : null,
  };
}
