// @flow

import * as db from '../mem-db';
import type { ApiSpec } from '../types';

export function getById(id: string): ApiSpec | void {
  return db.getWhere('ApiSpec', spec => spec.contents === id);
}

export function getByParentId(parentId: string): ApiSpec | void {
  return db.getWhere('ApiSpec', spec => spec.parentId === parentId);
}
