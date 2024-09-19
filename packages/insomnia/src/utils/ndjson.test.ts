import { expect, test } from 'vitest';

import { deserializeNDJSON, serializeNDJSON } from './ndjson';

test('can deserialize', () => {
  const data = '{"name":"test"}\n{"name":"test2"}\n';
  const result = deserializeNDJSON(data);
  expect(result).toEqual([{ name: 'test' }, { name: 'test2' }]);
});
test('can deserialize with empty lines', () => {
  const data = '{"name":"test"}\n\n{"name":"test2"}\n';
  const result = deserializeNDJSON(data);
  expect(result).toEqual([{ name: 'test' }, { name: 'test2' }]);
});
test('can serialize', () => {
  const data = [{ name: 'test' }, { name: 'test2' }];
  const result = serializeNDJSON(data);
  expect(result).toEqual('{"name":"test"}\n{"name":"test2"}\n');
});
