import { describe, expect, it } from 'vitest';

import { convert } from './curl';

describe('curl', () => {
  const testCases = [
    // --data flags with urlencoded content type
    {
      name: 'should handle -d with key=value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' -d 'key=value'",
      expected: { body: { params: [{ name: 'key', value: 'value' }] } },
    },
    {
      name: 'should handle -d with only a value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' -d 'value'",
      expected: { body: { params: [{ name: '', value: 'value' }] } },
    },
    {
      name: 'should handle -d with @filename',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' -d '@filename'",
      expected: { body: { params: [{ name: '', fileName: 'filename', type: 'file' }] } },
    },
    {
      name: 'should handle multiple -d flags',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' -d 'first=1' -d 'second=2' -d 'third'",
      expected: {
        body: {
          params: [
            { name: 'first', value: '1' },
            { name: 'second', value: '2' },
            { name: '', value: 'third' },
          ],
        },
      },
    },
    {
      name: 'should handle -d with url-encoded ampersand',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' -d 'first=1&second=2'",
      expected: {
        body: {
          params: [
            { name: 'first', value: '1' },
            { name: 'second', value: '2' },
          ],
        },
      },
    },
    {
      name: 'should handle -d with encoded equals sign',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' -d '%3D'",
      expected: { body: { params: [{ name: '', value: '=' }] } },
    },
    {
      name: 'should handle --d with encoded equals signs in key and value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --d '%3D=%3D'",
      expected: { body: { params: [{ name: '=', value: '=' }] } },
    },
    // --data
    {
      name: 'should handle --data with json string',
      curl: `curl -X POST http://httpbin.org/post -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Request-ID: abc123' -d '{"user":{"name":"John","email":"john@example.com"}}'`,
      expected: { body: { text: '{"user":{"name":"John","email":"john@example.com"}}' } },
    },
    {
      name: 'should handle --data with key=value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data 'key=value'",
      expected: { body: { params: [{ name: 'key', value: 'value' }] } },
    },
    {
      name: 'should handle --data with only a value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data 'value'",
      expected: { body: { params: [{ name: '', value: 'value' }] } },
    },
    {
      name: 'should handle --data with @filename',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data '@filename'",
      expected: { body: { params: [{ name: '', fileName: 'filename' }] } },
    },
    {
      name: 'should handle multiple --data flags',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data 'first=1' --data 'second=2' --data 'third'",
      expected: {
        body: {
          params: [
            { name: 'first', value: '1' },
            { name: 'second', value: '2' },
            { name: '', value: 'third' },
          ],
        },
      },
    },
    {
      name: 'should handle --data with url-encoded ampersand',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data 'first=1&second=2'",
      expected: {
        body: {
          params: [
            { name: 'first', value: '1' },
            { name: 'second', value: '2' },
          ],
        },
      },
    },
    {
      name: 'should handle --data with base64 value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data 'base64=SGVsbG8='",
      expected: { body: { params: [{ name: 'base64', value: 'SGVsbG8=' }] } },
    },
    // --data-ascii
    {
      name: 'should handle --data-ascii with key=value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-ascii 'key=value'",
      expected: { body: { params: [{ name: 'key', value: 'value' }] } },
    },
    {
      name: 'should handle --data-ascii with @filename',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-ascii '@filename'",
      expected: { body: { params: [{ name: '', fileName: 'filename', type: 'file' }] } },
    },
    // --data-binary
    {
      name: 'should handle --data-binary with key=value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-binary 'key=value'",
      expected: { body: { params: [{ name: 'key', value: 'value' }] } },
    },
    {
      name: 'should handle --data-binary with @filename',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-binary '@filename'",
      expected: { body: { params: [{ name: '', fileName: 'filename', type: 'file' }] } },
    },
    {
      name: 'should handle --data-binary with JSON string',
      curl: `curl -X POST https://example.com -H 'Content-Type: application/json' --data-binary '{"foo":"sGrG5sXDP5vX=p41h9tBcaQ==","bar":"123"}'`,
      expected: { body: { text: '{"foo":"sGrG5sXDP5vX=p41h9tBcaQ==","bar":"123"}' } },
    },
    {
      name: 'should handle --data-binary with multiple equals signs',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-binary 'key=value=with=equals'",
      expected: { body: { params: [{ name: 'key', value: 'value=with=equals' }] } },
    },
    // --data-raw
    {
      name: 'should handle --data-raw with @filename literally',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-raw '@filename'",
      expected: { body: { params: [{ name: '', value: '@filename' }] } },
    },
    {
      name: 'should handle --data-raw with key=value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-raw 'key=value'",
      expected: { body: { params: [{ name: 'key', value: 'value' }] } },
    },
    // --data-urlencode
    {
      name: 'should handle --data-urlencode with key=value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode 'key=value'",
      expected: { body: { params: [{ name: 'key', value: 'value' }] } },
    },
    {
      name: 'should handle --data-urlencode with key@filename',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode 'key@filename'",
      expected: { body: { params: [{ name: 'key', fileName: 'filename', type: 'file' }] } },
    },
    {
      name: 'should handle --data-urlencode with =value',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode '=value'",
      expected: { body: { params: [{ name: '', value: 'value' }] } },
    },
    {
      name: 'should handle --data-urlencode with special characters',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode ' '",
      expected: { body: { params: [{ name: '', value: ' ' }] } },
    },
    {
      name: 'should handle --data-urlencode with only equals',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode '='",
      expected: { body: { params: [{ name: '', value: '' }] } },
    },
    {
      name: 'should handle --data-urlencode with encoded equals',
      curl: "curl -X POST https://example.com -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode '%3D'",
      expected: { body: { params: [{ name: '', value: '%3D' }] } },
    },

    // --data flags without urlencoded content type
    {
      name: 'should handle -d as raw text body',
      curl: "curl -X POST https://example.com -d 'key=value'",
      expected: { body: { text: 'key=value' } },
    },

    // -H flags
    {
      name: 'should handle -H with space after colon',
      curl: "curl https://example.com -H 'X-Host: example.com'",
      expected: { headers: [{ name: 'X-Host', value: 'example.com' }] },
    },
    {
      name: 'should handle -H with no space after colon',
      curl: "curl https://example.com -H 'X-Host:example.com'",
      expected: { headers: [{ name: 'X-Host', value: 'example.com' }] },
    },
    {
      name: 'should handle -H for Content-Type',
      curl: "curl https://example.com -H 'Content-Type:application/x-www-form-urlencoded'",
      expected: { headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }] },
    },
    {
      name: 'should handle -H with leading spaces before flag',
      curl: "curl https://example.com    -H 'Content-Type:application/x-www-form-urlencoded'",
      expected: { headers: [{ name: 'Content-Type', value: 'application/x-www-form-urlencoded' }] },
    },
    // auth
    {
      name: 'should handle -u for basic auth',
      curl: 'curl https://example.com -u username:password',
      expected: { authentication: { username: 'username', password: 'password' } },
    },
    {
      name: 'should handle --user for basic auth',
      curl: 'curl https://example.com --user username:password',
      expected: { authentication: { username: 'username', password: 'password' } },
    },
    {
      name: 'should handle bearer',
      curl: `curl http://httpbin.org/get -H 'Authorization: Bearer mytoken123'`,
      expected: {
        authentication: { type: 'bearer', token: 'mytoken123' },
        headers: [],
      },
    },
    {
      name: 'should handle bearer auth and normal header auth together',
      curl: `curl http://httpbin.org/get -H 'x-foo: x-bar' -H 'Authorization: Bearer mytoken123' `,
      expected: {
        authentication: { type: 'bearer', token: 'mytoken123' },
        headers: [{ name: 'x-foo', value: 'x-bar' }],
      },
    },
  ];

  it.each(testCases)('$name', ({ curl, expected }) => {
    const result = convert(curl);
    expect(result).toMatchObject([expected]);
  });
});
