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
      return (a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1);
    case SORT_NAME_DESC:
      return (a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? -1 : 1);
    case SORT_CREATED_FIRST:
      return (a, b) => (a.created < b.created ? -1 : 1);
    case SORT_CREATED_LAST:
      return (a, b) => (a.created > b.created ? -1 : 1);
    case SORT_METHOD:
      return (a, b) => {
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
      };
    case SORT_TYPE_ASC:
      return (a, b) => {
        if (a.type === b.type) {
          return a.metaSortKey < b.metaSortKey ? -1 : 1;
        } else {
          return a.type === requestGroup.type ? -1 : 1;
        }
      };
    case SORT_TYPE_DESC:
      return (a, b) => {
        if (a.type === b.type) {
          return a.metaSortKey < b.metaSortKey ? -1 : 1;
        } else {
          return a.type === request.type ? -1 : 1;
        }
      };
    default:
      return (a, b) => (a.metaSortKey < b.metaSortKey ? -1 : 1);
  }
}
