// @flow
import {
  HTTP_METHODS,
  SortOrder,
  SORT_CREATED_FIRST,
  SORT_CREATED_LAST,
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
): (a: Request | RequestGroup, b: Request | RequestGroup) => -1 | 1 {
  switch (order) {
    case SORT_NAME_ASC:
      return ascendingNameSort;
    case SORT_NAME_DESC:
      return descendingNameSort;
    case SORT_CREATED_FIRST:
      return createdFirstSort;
    case SORT_CREATED_LAST:
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

function ascendingNameSort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  return a.name.localeCompare(b.name);
}

function descendingNameSort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  return b.name.localeCompare(a.name);
}

function createdFirstSort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  return a.created < b.created ? -1 : 1;
}

function createdLastSort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  return a.created > b.created ? -1 : 1;
}

function httpMethodSort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  if (a.type !== b.type) {
    return a.type === request.type ? -1 : 1;
  } else if (a.type === request.type) {
    const aIndex = HTTP_METHODS.indexOf(a.method);
    const bIndex = HTTP_METHODS.indexOf(b.method);
    if (aIndex !== bIndex) {
      return aIndex < bIndex ? -1 : 1;
    } else {
      return a.metaSortKey < b.metaSortKey ? -1 : 1;
    }
  } else {
    return a.metaSortKey < b.metaSortKey ? -1 : 1;
  }
}

function ascendingTypeSort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  if (a.type === b.type) {
    return a.metaSortKey < b.metaSortKey ? -1 : 1;
  } else {
    return a.type === requestGroup.type ? -1 : 1;
  }
}

function descendingTypeSort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  if (a.type === b.type) {
    return a.metaSortKey < b.metaSortKey ? -1 : 1;
  } else {
    return a.type === request.type ? -1 : 1;
  }
}

function metaSortKeySort(a: Request | RequestGroup, b: Request | RequestGroup): 1 | -1 {
  return a.metaSortKey < b.metaSortKey ? -1 : 1;
}
