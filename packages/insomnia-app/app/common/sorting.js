// @flow
import {
  HTTP_METHODS,
  SortOrder,
  SORT_CREATED_ASC,
  SORT_CREATED_DESC,
  SORT_HTTP_METHOD,
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
  // Sort Requests and GrpcRequests to top, in that order
  if (a.type !== b.type) {
    if (isRequest(a) || isRequest(b)) {
      return isRequest(a) ? -1 : 1;
    }

    if (isGrpcRequest(a) || isGrpcRequest(b)) {
      return isGrpcRequest(a) ? -1 : 1;
    }
  }

  // Sort Requests by HTTP method
  if (isRequest(a)) {
    const aIndex = HTTP_METHODS.indexOf(a.method);
    const bIndex = HTTP_METHODS.indexOf(b.method);
    if (aIndex !== bIndex) {
      return aIndex < bIndex ? -1 : 1;
    }

    // Sort by ascending method name if comparing two custom methods
    if (aIndex === -1 && a.method.localeCompare(b.method) !== 0) {
      return a.method.localeCompare(b.method);
    }
  }

  // Sort by metaSortKey if comparing two Requests with the same method,
  // two GrpcRequests, or two RequestGroups
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

export const ascendingNumberSort = (a: number, b: number): number => {
  return a < b ? -1 : 1;
};

export const descendingNumberSort = (a: number, b: number): number => {
  return ascendingNumberSort(b, a);
};

export const sortMethodMap: { [SortOrder]: SortFunction } = {
  [SORT_NAME_ASC]: ascendingNameSort,
  [SORT_NAME_DESC]: descendingNameSort,
  [SORT_CREATED_ASC]: createdFirstSort,
  [SORT_CREATED_DESC]: createdLastSort,
  [SORT_HTTP_METHOD]: httpMethodSort,
  [SORT_TYPE_DESC]: descendingTypeSort,
  [SORT_TYPE_ASC]: ascendingTypeSort,
};
