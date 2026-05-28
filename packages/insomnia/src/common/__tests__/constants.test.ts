import { describe, expect, it } from 'vitest';

import type { MockServer } from '~/insomnia-data';

import {
  FLEXIBLE_URL_REGEX,
  getContentTypeName,
  getMockServiceBinURL,
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
    expect(isWorkspaceActivity('spec')).toBe(true);
    expect(isWorkspaceActivity('debug')).toBe(true);
    expect(isWorkspaceActivity('unittest')).toBe(true);
  });

  it('should return false', () => {
    expect(isWorkspaceActivity('home')).toBe(false);
  });
});

describe('isValidActivity', () => {
  it('should return true', () => {
    expect(isValidActivity('spec')).toBe(true);
    expect(isValidActivity('debug')).toBe(true);
    expect(isValidActivity('unittest')).toBe(true);
    expect(isValidActivity('home')).toBe(true);
  });

  it('should return false', () => {
    expect(isValidActivity('something else')).toBe(false);
    // @ts-expect-error intentionally invalid
    expect(isValidActivity(null)).toBe(false);
    // @ts-expect-error intentionally invalid
    expect(isValidActivity()).toBe(false);
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
    expect(getContentTypeName('application/yaml')).toBe('YAML');
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

describe('getMockSeviceBinUrl', () => {
  it('should return correct mock url', () => {
    expect(
      getMockServiceBinURL(
        {
          useInsomniaCloud: true,
          _id: 'mock_617eac05d9a94e38a1187f9b4400039b',
          url: '',
        } as MockServer,
        '/my-route',
      ),
    ).toBe('https://mock-617eac05d9a94e38a1187f9b4400039b.mock.insomnia.run/my-route');
    expect(
      getMockServiceBinURL(
        {
          useInsomniaCloud: false,
          _id: 'mock_617eac05d9a94e38a1187f9b4400039b',
          url: 'http://localhost:8080',
        } as MockServer,
        '/my-route',
      ),
    ).toBe('http://localhost:8080/bin/mock_617eac05d9a94e38a1187f9b4400039b/my-route');
  });
});
