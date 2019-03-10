// @flow

import crypto from 'crypto';
import { deterministicStringify } from './deterministicStringify';

export function jsonHash(content: any): string {
  return crypto
    .createHash('sha1')
    .update(deterministicStringify(content))
    .digest('hex');
}
