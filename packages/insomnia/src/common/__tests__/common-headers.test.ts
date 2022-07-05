import { describe, expect, it } from '@jest/globals';

import allCharsets from '../../datasets/charsets';
import allMimeTypes from '../../datasets/content-types';
import allEncodings from '../../datasets/encodings';
import allHeaderNames from '../../datasets/header-names';
import { getCommonHeaderNames, getCommonHeaderValues } from '../common-headers';

describe('getCommonHeaderNames', () => {
  it('should return common header names', () => {
    expect(getCommonHeaderNames()).toBe(allHeaderNames);
  });
});

describe('getCommonHeaderValues', () => {
  it('should return mime types for accept', () => {
    const header = {
      name: 'Accept',
      value: 'test',
    };
    expect(getCommonHeaderValues(header)).toEqual(expect.arrayContaining(allMimeTypes));
  });

  it('should return mime types for content-type', () => {
    const header = {
      name: 'Content-Type',
      value: 'test',
    };
    expect(getCommonHeaderValues(header)).toEqual(expect.arrayContaining(allMimeTypes));
  });

  it('should return charsets for accept-charset', () => {
    const header = {
      name: 'Accept-Charset',
      value: 'test',
    };
    expect(getCommonHeaderValues(header)).toEqual(expect.arrayContaining(allCharsets));
  });

  it('should return encodings for accept-encoding', () => {
    const header = {
      name: 'Accept-Encoding',
      value: 'test',
    };
    expect(getCommonHeaderValues(header)).toEqual(expect.arrayContaining(allEncodings));
  });

  it('should return empty array for unknown header name', () => {
    const header = {
      name: 'Some-Header-Name',
      value: 'test',
    };
    expect(getCommonHeaderValues(header)).toEqual(expect.arrayContaining([]));
  });
});
