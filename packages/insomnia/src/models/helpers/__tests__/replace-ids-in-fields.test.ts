import { describe, expect, it } from 'vitest';

import { replaceIdsInFields } from '../replace-ids-in-fields';

describe('replaceIdsInFields', () => {
  const idMapping = new Map([
    ['req_old1', 'req_new1'],
    ['req_old2', 'req_new2'],
  ]);

  it('should replace ids in a simple string field', () => {
    const doc = { url: "{% response 'body', 'req_old1', '' %}", name: 'test' };
    const result = replaceIdsInFields(doc, ['url'], idMapping);
    expect(result).toEqual({ url: "{% response 'body', 'req_new1', '' %}" });
  });

  it('should replace ids in nested objects', () => {
    const doc = {
      body: { text: 'ref: req_old1 and req_old2' },
      name: 'test',
    };
    const result = replaceIdsInFields(doc, ['body'], idMapping);
    expect(result).toEqual({ body: { text: 'ref: req_new1 and req_new2' } });
  });

  it('should replace ids in arrays', () => {
    const doc = {
      headers: [
        { name: 'X-Ref', value: "{% response 'body', 'req_old1', '' %}" },
        { name: 'X-Other', value: 'static' },
      ],
    };
    const result = replaceIdsInFields(doc, ['headers'], idMapping);
    expect(result).toEqual({
      headers: [
        { name: 'X-Ref', value: "{% response 'body', 'req_new1', '' %}" },
        { name: 'X-Other', value: 'static' },
      ],
    });
  });

  it('should return empty patch when no ids are found', () => {
    const doc = { url: 'https://example.com', name: 'test' };
    const result = replaceIdsInFields(doc, ['url'], idMapping);
    expect(result).toEqual({});
  });

  it('should skip null and undefined fields', () => {
    const doc = { url: null as string | null, body: undefined as string | undefined, name: 'test' };
    const result = replaceIdsInFields(doc, ['url', 'body'], idMapping);
    expect(result).toEqual({});
  });

  it('should only process specified fields', () => {
    const doc = {
      url: 'req_old1',
      name: 'req_old1',
    };
    const result = replaceIdsInFields(doc, ['url'], idMapping);
    expect(result).toEqual({ url: 'req_new1' });
  });

  it('should replace multiple ids in the same field', () => {
    const doc = {
      url: "{% response 'body', 'req_old1' %}/{% response 'body', 'req_old2' %}",
    };
    const result = replaceIdsInFields(doc, ['url'], idMapping);
    expect(result).toEqual({
      url: "{% response 'body', 'req_new1' %}/{% response 'body', 'req_new2' %}",
    });
  });

  it('should handle multiple occurrences of the same id', () => {
    const doc = {
      url: 'req_old1/req_old1',
    };
    const result = replaceIdsInFields(doc, ['url'], idMapping);
    expect(result).toEqual({ url: 'req_new1/req_new1' });
  });
});
