
import allCharsets from '../datasets/charsets';
import allMimeTypes from '../datasets/content-types';
import allEncodings from '../datasets/encodings';
import allHeaderNames from '../datasets/header-names';
import type { RequestHeader } from '../models/request';

export const SINGLE_VALUE_HEADERS = [
  'proxy-authorization',
  'content-length',
  'content-type',
  'content-encoding',
  'content-location',
  'connection',
  'host',
  'upgrade',
  'range',
  'trailer',
];

export const getCommonHeaderValues = (pair: RequestHeader): any[] => {
  switch (pair.name.toLowerCase()) {
    case 'content-type':
    case 'accept':
      return allMimeTypes;

    case 'accept-charset':
      return allCharsets;

    case 'accept-encoding':
      return allEncodings;

    default:
      return [];
  }
};

export const getCommonHeaderNames = (): any[] => {
  return allHeaderNames;
};
