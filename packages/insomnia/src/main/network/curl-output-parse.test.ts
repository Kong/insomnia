import { describe, expect, it } from 'vitest';

import { parseCurlHeaders } from './curl-output-parse';
describe('parseCurlHeaders', () => {
  it('parses valid curl output with headers', () => {
    const input = `
== Info: Host httpbin.org:80 was resolved.
== Info: IPv6: (none)
== Info: IPv4: 44.207.188.95, 3.229.116.23, 3.233.51.125, 54.243.106.191, 54.164.55.235, 3.213.24.5
== Info:   Trying 44.207.188.95:80...
== Info: Connected to httpbin.org (44.207.188.95) port 80
=> Send header, 88 bytes (0x58)
0000: GET /ip HTTP/1.1
0012: Host: httpbin.org
0025: Accept: */*
0032: User-Agent: insomnia/10.3.2-beta.0
0056: 
== Info: Request completely sent off
<= Recv header, 17 bytes (0x11)
0000: HTTP/1.1 200 OK
<= Recv header, 37 bytes (0x25)
0000: Date: Tue, 15 Jul 2025 07:28:23 GMT
<= Recv header, 32 bytes (0x20)
0000: Content-Type: application/json
<= Recv header, 20 bytes (0x14)
0000: Content-Length: 32
<= Recv header, 24 bytes (0x18)
0000: Connection: keep-alive
<= Recv header, 25 bytes (0x19)
0000: Server: gunicorn/19.9.0
<= Recv header, 32 bytes (0x20)
0000: Access-Control-Allow-Origin: *
<= Recv header, 40 bytes (0x28)
0000: Access-Control-Allow-Credentials: true
<= Recv header, 2 bytes (0x2)
0000: 
<= Recv data, 32 bytes (0x20)
0000: {.  "origin": "92.109.73.198".}.
== Info: Connection #0 to host httpbin.org left intact

`;

    const result = parseCurlHeaders(input);
    expect(result).toStrictEqual({
      version: 'HTTP/1.1',
      code: 200,
      reason: 'OK',
      headers: [
        { name: 'Date', value: 'Tue, 15 Jul 2025 07:28:23 GMT' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Content-Length', value: '32' },
        { name: 'Connection', value: 'keep-alive' },
        { name: 'Server', value: 'gunicorn/19.9.0' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
        { name: 'Access-Control-Allow-Credentials', value: 'true' },
      ],
    });
  });
});
