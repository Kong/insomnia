// @flow

import crypto from 'crypto';
import { deterministicStringify } from './deterministicStringify';

export function jsonHash(value: any): { content: string, hash: string } {
  const stringified = deterministicStringify(value);

  const content = stringified;
  const hash = crypto
    .createHash('sha1')
    .update(content)
    .digest('hex');

  return { hash, content };
}
