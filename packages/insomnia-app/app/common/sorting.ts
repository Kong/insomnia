import { GrpcRequest, isGrpcRequest } from '../models/grpc-request';
import { isRequest, Request } from '../models/request';
import { isRequestGroup, RequestGroup } from '../models/request-group';
import {
  HTTP_METHODS,
  SORT_CREATED_ASC,
  SORT_CREATED_DESC,
  SORT_HTTP_METHOD,
  SORT_MODIFIED_ASC,
  SORT_MODIFIED_DESC,
  SORT_NAME_ASC,
  SORT_NAME_DESC,
  SORT_TYPE_ASC,
  SORT_TYPE_DESC,
} from './constants';

type SortableModel = Request | RequestGroup | GrpcRequest;
type SortFunction<SortableType> = (a: SortableType, b: SortableType) => number;

export const ascendingNameSort: SortFunction<{name: string}> = (a, b) => {
  return a.name.localeCompare(b.name);
};

export const descendingNameSort: SortFunction<{name: string}> = (a, b) => {
  return b.name.localeCompare(a.name);
};

export const createdFirstSort: SortFunction<{created: number}> = (a, b) => {
  if (a.created === b.created) {
    return 0;
  }

  return a.created < b.created ? -1 : 1;
};

export const createdLastSort: SortFunction<{created: number}> = (a, b) => {
  if (a.created === b.created) {
    return 0;
  }

  return a.created > b.created ? -1 : 1;
};

export const ascendingModifiedSort: SortFunction<{lastModifiedTimestamp: number}> = (a, b) => {
  if (a.lastModifiedTimestamp === b.lastModifiedTimestamp) {
    return 0;
  }

  return a.lastModifiedTimestamp < b.lastModifiedTimestamp ? -1 : 1;
};

export const descendingModifiedSort: SortFunction<{lastModifiedTimestamp: number}> = (a, b) => {
  if (a.lastModifiedTimestamp === b.lastModifiedTimestamp) {
    return 0;
  }

  return a.lastModifiedTimestamp > b.lastModifiedTimestamp ? -1 : 1;
};

export const httpMethodSort: SortFunction<Pick<SortableModel, 'type' | 'metaSortKey' | '_id'>> = (a, b) => {
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
    // @ts-expect-error -- TSCONVERSION
    const bIndex = HTTP_METHODS.indexOf(b.method);

    if (aIndex !== bIndex) {
      return aIndex < bIndex ? -1 : 1;
    }

    // Sort by ascending method name if comparing two custom methods
    // @ts-expect-error -- TSCONVERSION
    if (aIndex === -1 && a.method.localeCompare(b.method) !== 0) {
      // @ts-expect-error -- TSCONVERSION
      return a.method.localeCompare(b.method);
    }
  }

  // Sort by metaSortKey if comparing two Requests with the same method,
  // two GrpcRequests, or two RequestGroups
  return metaSortKeySort(a, b);
};

export const ascendingTypeSort: SortFunction<Pick<SortableModel, 'type' | 'metaSortKey' | '_id'>> = (a, b) => {
  if (a.type !== b.type && (isRequestGroup(a) || isRequestGroup(b))) {
    return isRequestGroup(b) ? -1 : 1;
  }

  return metaSortKeySort(a, b);
};

export const descendingTypeSort: SortFunction<Pick<SortableModel, 'type' | 'metaSortKey' | '_id'>> = (a, b) => {
  if (a.type !== b.type && (isRequestGroup(a) || isRequestGroup(b))) {
    return isRequestGroup(a) ? -1 : 1;
  }

  return metaSortKeySort(a, b);
};

export const metaSortKeySort: SortFunction<Pick<SortableModel, '_id' | 'metaSortKey'>> = (a, b) => {
  if (a.metaSortKey === b.metaSortKey) {
    return a._id > b._id ? -1 : 1;
  }

  return a.metaSortKey < b.metaSortKey ? -1 : 1;
};

export const ascendingNumberSort: SortFunction<number> = (a, b) => {
  return a < b ? -1 : 1;
};

export const descendingNumberSort: SortFunction<number> = (a, b) => {
  return ascendingNumberSort(b, a);
};

export const sortMethodMap = {
  [SORT_NAME_ASC]: ascendingNameSort,
  [SORT_NAME_DESC]: descendingNameSort,
  [SORT_CREATED_ASC]: createdFirstSort,
  [SORT_CREATED_DESC]: createdLastSort,
  [SORT_MODIFIED_ASC]: ascendingModifiedSort,
  [SORT_MODIFIED_DESC]: descendingModifiedSort,
  [SORT_HTTP_METHOD]: httpMethodSort,
  [SORT_TYPE_DESC]: descendingTypeSort,
  [SORT_TYPE_ASC]: ascendingTypeSort,
};
