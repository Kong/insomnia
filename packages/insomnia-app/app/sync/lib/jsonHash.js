// @flow

import crypto from 'crypto';
import { deterministicStringify } from './deterministicStringify';

export function jsonHash(value: Object): { content: string, hash: string } {
  if (value === undefined) {
    throw new Error('Cannot hash undefined value');
  }

  const content = deterministicStringify(value);
  const hash = crypto
    .createHash('sha1')
    .update(content)
    .digest('hex');

  return { hash, content };
}
