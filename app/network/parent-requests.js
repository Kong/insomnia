// @flow
import type {Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter} from '../models/request';
import {AUTH_NONE, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED} from '../common/constants';

type Pair = {name: string, value: string, disabled?: boolean};

export function extendRequest (parent: Request | null, child: Request): Request {
  if (!child) {
    throw new Error('Cannot extend null child request');
  }

  if (!parent) {
    return child;
  }

  const newRequest: Request = {
    // Trivial properties
    _id: child._id,
    type: child.type,
    parentId: child.parentId,
    modified: child.modified,
    created: child.created,
    settingStoreCookies: child.settingSendCookies,
    settingSendCookies: child.settingSendCookies,
    settingDisableRenderRequestBody: child.settingDisableRenderRequestBody,
    settingEncodeUrl: child.settingEncodeUrl,
    name: child.name,
    description: child.description,
    method: child.method,
    metaSortKey: child.metaSortKey,

    // Complex properties
    url: _extendUrl(parent.url, child.url),
    body: _extendBody(parent.body, child.body),
    parameters: _extendParameters(parent.parameters, child.parameters),
    headers: _extendHeaders(parent.headers, child.headers),
    authentication: _extendAuthentication(parent.authentication, child.authentication)
  };

  return newRequest;
}

function _extendUrl (parentUrl: string, childUrl: string): string {
  return childUrl || parentUrl;
}

function _extendBody (parentBody: RequestBody, childBody: RequestBody): RequestBody {
  // Merge together if they are both form data or urlencoded
  const bothUrlEncoded = parentBody.mimeType === CONTENT_TYPE_FORM_URLENCODED &&
    childBody.mimeType === CONTENT_TYPE_FORM_URLENCODED;
  const bothFormData = parentBody.mimeType === CONTENT_TYPE_FORM_DATA &&
    childBody.mimeType === CONTENT_TYPE_FORM_DATA;
  if (bothUrlEncoded || bothFormData) {
    const params = _mergeNameValuePairs(parentBody.params || [], childBody.params || []);
    return Object.assign(childBody, {params});
  }

  console.log('BODY', parentBody, childBody);

  const childHasBodyText = !!childBody.text;
  const childHasBodyFile = !!childBody.fileName;
  const childHasBodyMimeType = typeof childBody.mimeType === 'string';
  const childHasBody = childHasBodyText || childHasBodyFile || childHasBodyMimeType;
  return childHasBody ? childBody : parentBody;
}

function _extendParameters (parentParameters, childParameters): Array<RequestParameter> {
  return _mergeNameValuePairs(parentParameters, childParameters);
}

function _extendHeaders (parentHeaders, childHeaders): Array<RequestHeader> {
  return _mergeNameValuePairs(parentHeaders, childHeaders);
}

function _extendAuthentication (parentAuthentication, childAuthentication): RequestAuthentication {
  const childHasAuth = childAuthentication.type && childAuthentication.type !== AUTH_NONE;
  return childHasAuth ? childAuthentication : parentAuthentication;
}

function _mergeNameValuePairs<T: Pair> (parent: Array<T>, child: Array<T>): Array<T> {
  const newPairs = [];
  for (const parentPair of parent) {
    if (parentPair.disabled) {
      continue;
    }

    const childPair = child.find(p => p.name === parentPair.name);
    if (childPair && !childPair.disabled) {
      continue;
    }

    newPairs.push(parentPair);
  }

  return [...newPairs, ...child];
}
