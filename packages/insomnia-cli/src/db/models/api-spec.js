// @flow

import * as db from '../mem-db';
import type { ApiSpec } from '../types';

export function getById(id: string): ApiSpec | void {
  return db.getWhere('ApiSpec', spec => spec._id === id);
}

export function getByParentId(parentId: string): ApiSpec | void {
  return db.getWhere('ApiSpec', spec => spec.parentId === parentId);
}
