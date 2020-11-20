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
import type { Request } from '../models/request';
import type { GrpcRequest } from '../models/grpc-request';
import type { RequestGroup } from '../models/request-group';
import { isGrpcRequest, isRequest, isRequestGroup } from '../models/helpers/is-model';

type SortableModel = Request | RequestGroup | GrpcRequest;
type SortFunction = (a: SortableModel, b: SortableModel) => number;

export function getSortMethod(order: SortOrder): SortFunction {
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

const ascendingNameSort: SortFunction = (a, b) => {
  return a.name.localeCompare(b.name);
};

const descendingNameSort: SortFunction = (a, b) => {
  return b.name.localeCompare(a.name);
};

const createdFirstSort: SortFunction = (a, b) => {
  if (a.created === b.created) {
    return 0;
  }

  return a.created < b.created ? -1 : 1;
};

const createdLastSort: SortFunction = (a, b) => {
  if (a.created === b.created) {
    return 0;
  }

  return a.created > b.created ? -1 : 1;
};

const httpMethodSort: SortFunction = (a, b) => {
  if (a.type !== b.type) {
    if (isRequest(a) || isRequest(b)) {
      return isRequest(a) ? -1 : 1;
    }

    if (isGrpcRequest(a) || isGrpcRequest(b)) {
      return isGrpcRequest(a) ? -1 : 1;
    }
  }

  if (isRequest(a)) {
    const aIndex = HTTP_METHODS.indexOf(a.method);
    const bIndex = HTTP_METHODS.indexOf(b.method);
    if (aIndex !== bIndex) {
      return aIndex < bIndex ? -1 : 1;
    }

    if (aIndex === -1 && a.method.localeCompare(b.method) !== 0) {
      return a.method.localeCompare(b.method);
    }
  }

  return metaSortKeySort(a, b);
};

const ascendingTypeSort: SortFunction = (a, b) => {
  if (a.type !== b.type && (isRequestGroup(a) || isRequestGroup(b))) {
    return isRequestGroup(b) ? -1 : 1;
  }

  return metaSortKeySort(a, b);
};

const descendingTypeSort: SortFunction = (a, b) => {
  if (a.type !== b.type && (isRequestGroup(a) || isRequestGroup(b))) {
    return isRequestGroup(a) ? -1 : 1;
  }

  return metaSortKeySort(a, b);
};

export const metaSortKeySort: SortFunction = (a, b) => {
  if (a.metaSortKey === b.metaSortKey) {
    return a._id > b._id ? -1 : 1;
  }

  return a.metaSortKey < b.metaSortKey ? -1 : 1;
};
