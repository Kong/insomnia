// @flow
import {
  HTTP_METHODS,
  SortOrder,
  SORT_CREATED_ASC,
  SORT_CREATED_DESC,
  SORT_METHOD,
  SORT_NAME_ASC,
  SORT_NAME_DESC,
  SORT_TYPE_ASC,
  SORT_TYPE_DESC,
} from './constants';
import { request, requestGroup } from '../models';
import type { Request } from '../../models/request';
import type { RequestGroup } from '../../models/request-group';

export function getSortMethod(
  order: SortOrder,
): (a: Request | RequestGroup, b: Request | RequestGroup) => number {
  switch (order) {
    case SORT_NAME_ASC:
      return ascendingNameSort;
    case SORT_NAME_DESC:
      return descendingNameSort;
    case SORT_CREATED_ASC:
      return createdFirstSort;
    case SORT_CREATED_DESC:
      return createdLastSort;
    case SORT_METHOD:
      return httpMethodSort;
    case SORT_TYPE_ASC:
      return ascendingTypeSort;
    case SORT_TYPE_DESC:
      return descendingTypeSort;
    default:
      return metaSortKeySort;
  }
}

export function ascendingNameSort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  return a.name.localeCompare(b.name);
}

export function descendingNameSort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  return b.name.localeCompare(a.name);
}

export function createdFirstSort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  if (a.created === b.created) {
    return 0;
  }

  return a.created < b.created ? -1 : 1;
}

export function createdLastSort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  if (a.created === b.created) {
    return 0;
  }

  return a.created > b.created ? -1 : 1;
}

export function httpMethodSort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  if (a.type !== b.type) {
    return a.type === request.type ? -1 : 1;
  }

  if (a.type === request.type) {
    const aIndex = HTTP_METHODS.indexOf(a.method);
    const bIndex = HTTP_METHODS.indexOf(b.method);
    if (aIndex !== bIndex) {
      return aIndex < bIndex ? -1 : 1;
    }
  }

  return metaSortKeySort(a, b);
}

export function ascendingTypeSort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  if (a.type === b.type) {
    return metaSortKeySort(a, b);
  }

  return a.type === request.type ? -1 : 1;
}

export function descendingTypeSort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  if (a.type === b.type) {
    return metaSortKeySort(a, b);
  }

  return a.type === requestGroup.type ? -1 : 1;
}

export function metaSortKeySort(a: Request | RequestGroup, b: Request | RequestGroup): number {
  if (a.metaSortKey === b.metaSortKey) {
    return a._id > b._id ? -1 : 1;
  }

  return a.metaSortKey < b.metaSortKey ? -1 : 1;
}
