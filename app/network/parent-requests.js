// @flow
import type {Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter} from '../models/request';
import clone from 'clone';
import {AUTH_NONE, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED} from '../common/constants';

type Pair = {
  name: string,
  value: string,
  disabled?: boolean
};

export type RequestDiff = {
  url: string | null,
  headers: Array<RequestHeader> | null,
  parameters: Array<RequestParameter> | null,
  body: RequestBody | null,
  authentication: RequestAuthentication | null
};

export function extendRequest (parent: ?Request, child: Request): Request {
  const extendedRequest = diffRequest(parent, child);
  return patchRequest(child, extendedRequest);
}

export function diffRequest (parent: ?Request, child: Request): RequestDiff {
  const extendedRequest = {
    url: null,
    headers: null,
    parameters: null,
    body: null,
    authentication: null
  };

  if (!parent) {
    return extendedRequest;
  }

  if (!child) {
    throw new Error('Cannot extend empty child request');
  }

  extendedRequest.url = _diffUrl(parent.url, child.url);
  extendedRequest.headers = _diffNameValuePairs(parent.headers, child.headers);
  extendedRequest.parameters = _diffNameValuePairs(parent.parameters, child.parameters);
  extendedRequest.body = _diffBody(parent.body, child.body);
  extendedRequest.authentication = _diffAuthentication(parent.authentication, child.authentication);

  return extendedRequest;
}

export function patchRequest (child: Request, diff: ?RequestDiff): Request {
  const newRequest = clone(child);

  if (!diff) {
    return child;
  }

  if (diff.url) {
    newRequest.url = diff.url || newRequest.url;
  }

  if (diff.body && diff.body.params) {
    newRequest.body.params = _mergeNameValuePairs(diff.body.params, newRequest.body.params || []);
  } else if (diff.body) {
    newRequest.body = diff.body;
  }

  if (diff.parameters) {
    newRequest.parameters = _mergeNameValuePairs(diff.parameters, newRequest.parameters);
  }

  if (diff.headers) {
    newRequest.headers = _mergeNameValuePairs(diff.headers, newRequest.headers);
  }

  return newRequest;
}

function _diffUrl (parentUrl: string, childUrl: string): string | null {
  return childUrl ? null : parentUrl;
}

function _diffBody (parentBody: RequestBody, childBody: RequestBody): RequestBody | null {
  const bothUrlEncoded = parentBody.mimeType === CONTENT_TYPE_FORM_URLENCODED &&
    childBody.mimeType === CONTENT_TYPE_FORM_URLENCODED;
  const bothFormData = parentBody.mimeType === CONTENT_TYPE_FORM_DATA &&
    childBody.mimeType === CONTENT_TYPE_FORM_DATA;

  // Merge together if they are both form data or urlencoded
  if (bothUrlEncoded || bothFormData) {
    const params = _diffNameValuePairs(parentBody.params || [], childBody.params || []);
    return params ? Object.assign(clone(childBody), {params}) : null;
  }

  const childHasBodyText = !!childBody.text;
  const childHasBodyFile = !!childBody.fileName;
  const childHasBodyMimeType = typeof childBody.mimeType === 'string';
  const childHasBody = childHasBodyText || childHasBodyFile || childHasBodyMimeType;
  return childHasBody ? null : parentBody;
}

function _diffAuthentication (
  parentAuthentication,
  childAuthentication
): RequestAuthentication | null {
  const childHasAuth = childAuthentication.type && childAuthentication.type !== AUTH_NONE;
  return childHasAuth ? childAuthentication : parentAuthentication;
}

function _diffNameValuePairs<T: Pair> (
  parentPairs: Array<T>,
  childPairs: Array<T>
): Array<T> | null {
  const diffPairs = [];

  for (const parentPair of parentPairs) {
    // Ignore empty pairs
    if (!parentPair.name && !parentPair.value) {
      continue;
    }

    // Can we ignore the child?
    const childPair = childPairs.find(p => p.name === parentPair.name);
    if (childPair && !childPair.disabled) {
      continue;
    }

    diffPairs.push(clone(parentPair));
  }

  if (diffPairs.length === 0) {
    return null;
  }

  return diffPairs;
}

function _mergeNameValuePairs<T: Pair> (
  parentPairs: Array<T>,
  childPairs: Array<T>
): Array<T> {
  const validParents = [];
  for (const parentPair of parentPairs) {
    // Parent pair is disabled so act like it doesn't exist
    if (parentPair.disabled) {
      continue;
    }

    // Child overwrites parent?
    const childPair = childPairs.find(p => p.name === parentPair.name);
    if (childPair && !childPair.disabled) {
      continue;
    }

    validParents.push(parentPair);
  }

  return [...validParents, ...childPairs];
}
