import { describe, expect, it } from '@jest/globals';

import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  FLEXIBLE_URL_REGEX,
  getContentTypeName,
  isValidActivity,
  isWorkspaceActivity,
} from '../constants';

describe('URL Regex', () => {
  it('matches valid URLs', () => {
    expect('https://google.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://google.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://google.com/').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://google.com/').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://google').toMatch(FLEXIBLE_URL_REGEX);
    expect('https://dash-domain.com').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://localhost:8000').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://localhost:8000/foo/b@@r?hi=there#hello').toMatch(FLEXIBLE_URL_REGEX);
    expect('http://localhost:8000/foo?Signature=j4w98udA7~NbL6W4~UwAuj').toMatch(FLEXIBLE_URL_REGEX);
  });

  it('does not match "stop" characters', () => {
    expect('string').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('//relative-url.com').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('//relative').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('//relative').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('google.com').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('smtp://mailserver.com').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('"https://google.com"').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('(https://google.com)').not.toMatch(FLEXIBLE_URL_REGEX);
    expect('[https://google.com]').not.toMatch(FLEXIBLE_URL_REGEX);
  });
});

describe('isWorkspaceActivity', () => {
  it('should return true', () => {
    expect(isWorkspaceActivity(ACTIVITY_SPEC)).toBe(true);
    expect(isWorkspaceActivity(ACTIVITY_DEBUG)).toBe(true);
    expect(isWorkspaceActivity(ACTIVITY_UNIT_TEST)).toBe(true);
  });

  it('should return false', () => {
    expect(isWorkspaceActivity(ACTIVITY_HOME)).toBe(false);
  });
});

describe('isValidActivity', () => {
  it('should return true', () => {
    expect(isValidActivity(ACTIVITY_SPEC)).toBe(true);
    expect(isValidActivity(ACTIVITY_DEBUG)).toBe(true);
    expect(isValidActivity(ACTIVITY_UNIT_TEST)).toBe(true);
    expect(isValidActivity(ACTIVITY_HOME)).toBe(true);
  });

  it('should return false', () => {
    expect(isValidActivity('something else')).toBe(false);
    // @ts-expect-error intentionally invalid
    expect(isValidActivity(null)).toBe(false);
    // @ts-expect-error intentionally invalid
    expect(isValidActivity(undefined)).toBe(false);
  });
});

describe('getContentTypeName', () => {
  it('should return empty content type name', () => {
    expect(getContentTypeName()).toBe('');
  });
  it('should return content type name', () => {
    expect(getContentTypeName('application/json')).toBe('JSON');
    expect(getContentTypeName('application/json; charset=utf-8')).toBe('JSON');
    expect(getContentTypeName('text/plain')).toBe('Plain');
    expect(getContentTypeName('application/xml')).toBe('XML');
    expect(getContentTypeName('text/yaml')).toBe('YAML');
    expect(getContentTypeName('application/edn')).toBe('EDN');
    expect(getContentTypeName('application/x-www-form-urlencoded')).toBe('Form');
    expect(getContentTypeName('multipart/form-data')).toBe('Multipart');
    expect(getContentTypeName('application/graphql')).toBe('GraphQL');
    expect(getContentTypeName('application/octet-stream')).toBe('File');
  });
  it('should return unknown content type as other content type name name', () => {
    expect(getContentTypeName('unknown')).toBe('Other');
  });
});
