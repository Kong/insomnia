import { describe, expect, it } from 'vitest';

import { applyExpressionFields, extractFieldsFromExpression } from '../expression-parser';

describe('extractFieldsFromExpression', () => {
  it('single method', () => {
    const result = extractFieldsFromExpression('http.method == "GET"');
    expect(result.methods).toEqual(['GET']);
    expect(result.paths).toBeNull();
    expect(result.hosts).toBeNull();
    expect(result.headers).toBeNull();
  });

  it('single path (exact)', () => {
    const result = extractFieldsFromExpression('http.path == "/users"');
    expect(result.methods).toBeNull();
    expect(result.paths).toEqual(['/users']);
    expect(result.hosts).toBeNull();
    expect(result.headers).toBeNull();
  });

  it('single path (prefix)', () => {
    const result = extractFieldsFromExpression('http.path ^= "/api"');
    expect(result.methods).toBeNull();
    expect(result.paths).toEqual(['/api']);
    expect(result.hosts).toBeNull();
    expect(result.headers).toBeNull();
  });

  it('single host', () => {
    const result = extractFieldsFromExpression('http.host == "api.example.com"');
    expect(result.methods).toBeNull();
    expect(result.paths).toBeNull();
    expect(result.hosts).toEqual(['api.example.com']);
    expect(result.headers).toBeNull();
  });

  it('single header', () => {
    const result = extractFieldsFromExpression('http.headers.x_api_version == "2"');
    expect(result.methods).toBeNull();
    expect(result.paths).toBeNull();
    expect(result.hosts).toBeNull();
    expect(result.headers).toEqual({ 'x-api-version': ['2'] });
  });

  it('AND combination: method + path', () => {
    const result = extractFieldsFromExpression('http.method == "GET" && http.path == "/foo"');
    expect(result.methods).toEqual(['GET']);
    expect(result.paths).toEqual(['/foo']);
    expect(result.hosts).toBeNull();
    expect(result.headers).toBeNull();
  });

  it('full combination: method + path + host + header ANDed', () => {
    const result = extractFieldsFromExpression(
      'http.method == "POST" && http.path == "/submit" && http.host == "api.example.com" && http.headers.x_tenant == "acme"',
    );
    expect(result.methods).toEqual(['POST']);
    expect(result.paths).toEqual(['/submit']);
    expect(result.hosts).toEqual(['api.example.com']);
    expect(result.headers).toEqual({ 'x-tenant': ['acme'] });
  });

  it('OR methods', () => {
    const result = extractFieldsFromExpression('http.method == "GET" || http.method == "POST"');
    expect(result.methods).toEqual(['GET', 'POST']);
    expect(result.paths).toBeNull();
  });

  it('OR paths', () => {
    const result = extractFieldsFromExpression('http.path == "/v1" || http.path == "/v2"');
    expect(result.methods).toBeNull();
    expect(result.paths).toEqual(['/v1', '/v2']);
  });

  it('mixed AND/OR', () => {
    const result = extractFieldsFromExpression(
      '(http.method == "GET" || http.method == "POST") && http.path == "/api"',
    );
    expect(result.methods).toEqual(['GET', 'POST']);
    expect(result.paths).toEqual(['/api']);
  });

  it('unparseable — all null', () => {
    const result = extractFieldsFromExpression('net.src.ip in 10.0.0.0/8');
    expect(result.methods).toBeNull();
    expect(result.paths).toBeNull();
    expect(result.hosts).toBeNull();
    expect(result.headers).toBeNull();
  });

  it('empty string — all null', () => {
    const result = extractFieldsFromExpression('');
    expect(result.methods).toBeNull();
    expect(result.paths).toBeNull();
    expect(result.hosts).toBeNull();
    expect(result.headers).toBeNull();
  });

  it('negation ignored — methods null', () => {
    const result = extractFieldsFromExpression('http.method != "DELETE"');
    expect(result.methods).toBeNull();
  });

  it('regex path ignored — paths null', () => {
    const result = extractFieldsFromExpression('http.path ~ r#"^/users/\\d+$"#');
    expect(result.paths).toBeNull();
  });

  it('partial extraction: method extracted, unparseable part ignored', () => {
    const result = extractFieldsFromExpression('http.method == "GET" && net.src.ip in 10.0.0.0/8');
    expect(result.methods).toEqual(['GET']);
    expect(result.paths).toBeNull();
    expect(result.hosts).toBeNull();
    expect(result.headers).toBeNull();
  });

  it('header name normalization: underscores to hyphens, lowercased', () => {
    const result = extractFieldsFromExpression('http.headers.X_Custom_Id == "123"');
    expect(result.headers).toEqual({ 'x-custom-id': ['123'] });
  });
});

describe('applyExpressionFields', () => {
  const baseRoute = {
    id: 'r1', name: 'My Route', methods: null, paths: null,
    protocols: ['http'], hosts: null, headers: null, snis: null, service: null,
  };

  it('no expression — passthrough', () => {
    const result = applyExpressionFields({ ...baseRoute, expression: null });
    expect(result).toEqual({ syncable: true, route: { ...baseRoute, expression: null } });
  });

  it('tls.sni in expression — skipped', () => {
    const result = applyExpressionFields({ ...baseRoute, expression: 'tls.sni == "secure.example.com"' });
    expect(result.syncable).toBe(false);
    if (!result.syncable) {
      expect(result.reason).toMatch(/tls\.sni/);
    }
  });

  it('tls.sni combined with other predicates — still skipped', () => {
    const result = applyExpressionFields({ ...baseRoute, expression: 'tls.sni == "secure.example.com" && http.method == "GET"' });
    expect(result.syncable).toBe(false);
  });

  it('fully unparseable expression — skipped', () => {
    const result = applyExpressionFields({ ...baseRoute, expression: 'net.src.ip in 10.0.0.0/8' });
    expect(result.syncable).toBe(false);
    if (!result.syncable) {
      expect(result.reason).toMatch(/no extractable fields/);
    }
  });

  it('parseable expression — returns merged route', () => {
    const result = applyExpressionFields({ ...baseRoute, expression: 'http.method == "GET" && http.path == "/foo"' });
    expect(result.syncable).toBe(true);
    if (result.syncable) {
      expect(result.route.methods).toEqual(['GET']);
      expect(result.route.paths).toEqual(['/foo']);
    }
  });

  it('partial expression — syncable with extracted fields only', () => {
    const result = applyExpressionFields({ ...baseRoute, expression: 'http.method == "GET" && net.src.ip in 10.0.0.0/8' });
    expect(result.syncable).toBe(true);
    if (result.syncable) {
      expect(result.route.methods).toEqual(['GET']);
      expect(result.route.paths).toBeNull();
    }
  });
});
