import type {
  Request,
  RequestAuthentication,
  RequestGroup,
  RequestHeader,
  SocketIORequest,
  WebSocketRequest,
} from 'insomnia-data';

import { SINGLE_VALUE_HEADERS } from '../common/common-headers';
import { ascendingFirstIndexStringSort } from '../common/sorting';
import { getAuthObjectOrNull, isAuthEnabled } from './authentication';

export const getOrInheritAuthentication = ({
  request,
  // requestGroups is supposed to be of order leaf to root
  requestGroups,
}: {
  request: Request | WebSocketRequest | SocketIORequest;
  requestGroups: RequestGroup[];
}): RequestAuthentication | {} => {
  const hasValidAuth = getAuthObjectOrNull(request.authentication) && isAuthEnabled(request.authentication);
  if (hasValidAuth) {
    return request.authentication;
  }
  const hasParentFolders = requestGroups.length > 0;
  const closestParentFolderWithAuth = requestGroups.find(
    ({ authentication }) => getAuthObjectOrNull(authentication) && isAuthEnabled(authentication),
  );
  const closestAuth = getAuthObjectOrNull(closestParentFolderWithAuth?.authentication);
  const shouldCheckFolderAuth = hasParentFolders && closestAuth;
  if (shouldCheckFolderAuth) {
    // override auth with closest parent folder that has one set
    return closestAuth;
  }
  // if no auth is specified on request or folders, default to none
  return { type: 'none' };
};
export function getOrInheritHeaders({
  request,
  requestGroups,
}: {
  request: Pick<Request, 'headers'>;
  requestGroups: Pick<RequestGroup, 'headers'>[];
}): RequestHeader[] {
  const httpHeaders = new Map<string, string>();
  const originalCaseMap = new Map<string, string>();
  // parent folders, then child folders, then request
  const headerContexts = [...requestGroups].reverse().concat(request);
  const headers = headerContexts.flatMap(({ headers }) => headers || []);
  headers.forEach(({ name, value, disabled }) => {
    if (disabled || !name.trim()) {
      return;
    }
    const normalizedCase = name.toLowerCase();
    // preserves the casing of the last header with the same name
    originalCaseMap.set(normalizedCase, name);
    const isStrictValueHeader = SINGLE_VALUE_HEADERS.includes(normalizedCase);
    if (isStrictValueHeader) {
      httpHeaders.set(normalizedCase, value);
      return;
    }
    // appending will join matching header values with a comma
    if (httpHeaders.has(normalizedCase)) {
      httpHeaders.set(normalizedCase, `${httpHeaders.get(normalizedCase)}, ${value}`);
      return;
    }
    httpHeaders.set(normalizedCase, value);
  });
  return Array.from(httpHeaders.entries())
    .sort(ascendingFirstIndexStringSort)
    .map(([name, value]) => ({ name: originalCaseMap.get(name)!, value }));
}
