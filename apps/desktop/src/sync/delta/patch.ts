import type { Operation } from './diff';

export function patch(a: string, operations: Operation[]) {
  let result = '';

  for (const op of operations) {
    if (op.type === 'COPY') {
      result += a.slice(op.start, op.start + op.len);
    } else if (op.type === 'INSERT') {
      result += op.content;
    }
  }

  return result;
}
