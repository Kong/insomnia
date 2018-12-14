const tag = require('..').templateTags[0];
const iconv = require('iconv-lite');

describe('Response tag', () => {
  describe('General', () => {
    it('fails on no responses', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const context = _genTestContext(requests);

      try {
        await tag.run(context, 'body', 'req_1', '$.foo');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('No responses for request');
      }
    });

    it('fails on no request', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          _body: '{"foo": "bar"}',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_test', '$.foo');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('Could not find request req_test');
      }
    });

    it('fails on empty filter', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          _body: '{"foo": "bar"}',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('No body filter specified');
      }
    });
  });

  describe('JSONPath', () => {
    it('basic query', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json',
          _body: '{"foo": "bar"}',
        },
      ];

      const context = _genTestContext(requests, responses);
      const result = await tag.run(context, 'body', 'req_1', '$.foo');

      expect(result).toBe('bar');
    });

    it('fails on invalid JSON', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json',
          _body: '{"foo": "',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '$.foo');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('Invalid JSON: Unexpected end of JSON input');
      }
    });

    it('fails on invalid query', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json',
          _body: '{"foo": "bar"}',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '$$');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('Invalid JSONPath query: $$');
      }
    });

    it('fails on no results', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json',
          _body: '{"foo": "bar"}',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '$.missing');
        fail('JSON should have failed');
      } catch (err) {
        expect(err.message).toContain('Returned no results: $.missing');
      }
    });

    it('fails on more than 1 result', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json',
          _body: '{"array": ["bar", "baz"]}',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '$.array.*');
        fail('JSON should have failed to parse');
      } catch (err) {
        expect(err.message).toContain('Returned more than one result: $.array.*');
      }
    });

    it('works with utf-16 encoding', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/json; charset=UTF-16',
          _body: iconv.encode('{"array": ["bar", "baz"]}', 'UTF-16'),
        },
      ];

      const context = _genTestContext(requests, responses);

      expect(await tag.run(context, 'body', 'req_1', '$.array[0]')).toBe('bar');
    });
  });

  describe('XPath', async () => {
    it('renders basic response "body" query', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/xml',
          _body: '<foo><bar>Hello World!</bar></foo>',
        },
      ];

      const context = _genTestContext(requests, responses);
      const result = await tag.run(context, 'body', 'req_1', '/foo/bar');

      expect(result).toBe('Hello World!');
    });

    it('renders basic response "body" attribute query', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/xml',
          _body: '<foo><bar hello="World">Hello World!</bar></foo>',
        },
      ];

      const context = _genTestContext(requests, responses);
      const result = await tag.run(context, 'body', 'req_1', '/foo/bar/@hello');

      expect(result).toBe('World');
    });

    it('renders query that does not start with slash', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/xml',
          _body: '<foo><bar hello="World">Hello World!</bar></foo>',
        },
      ];

      const context = _genTestContext(requests, responses);
      const result = await tag.run(context, 'body', 'req_1', 'substring(/foo/bar, 7)');

      expect(result).toBe('World!');
    });

    it('no results on invalid XML', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/xml',
          _body: '<hi></hi></sstr>',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '/foo');
        fail('Should have failed');
      } catch (err) {
        expect(err.message).toContain('Returned no results: /foo');
      }
    });

    it('fails on invalid query', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/xml',
          _body: '<foo></foo>',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '//');
        fail('Should have failed');
      } catch (err) {
        expect(err.message).toContain('Invalid XPath query: //');
      }
    });

    it('fails on no results', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/xml',
          _body: '<foo></foo>',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '/missing');
        fail('Should have failed');
      } catch (err) {
        expect(err.message).toContain('Returned no results: /missing');
      }
    });

    it('fails on more than 1 result', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'application/xml',
          _body: '<foo><bar>Hello World!</bar><bar>And again!</bar></foo>',
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'body', 'req_1', '/foo/*');
        fail('Should have failed');
      } catch (err) {
        expect(err.message).toContain('Returned more than one result: /foo/*');
      }
    });
  });

  describe('ResponseExtension Header', async () => {
    it('renders basic response "header"', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: '',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Content-Length', value: '20' },
          ],
        },
      ];

      const context = _genTestContext(requests, responses);

      expect(await tag.run(context, 'header', 'req_1', 'content-type')).toBe('application/json');
      expect(await tag.run(context, 'header', 'req_1', 'Content-Type')).toBe('application/json');
      expect(await tag.run(context, 'header', 'req_1', 'CONTENT-type')).toBe('application/json');
      expect(await tag.run(context, 'header', 'req_1', 'CONTENT-type    ')).toBe(
        'application/json',
      );
    });

    it('no results on missing header', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Content-Length', value: '20' },
          ],
        },
      ];

      const context = _genTestContext(requests, responses);

      try {
        await tag.run(context, 'header', 'req_1', 'missing');
        fail('should have failed');
      } catch (err) {
        expect(err.message).toBe(
          'No header with name "missing".\n' +
            'Choices are [\n\t"Content-Type",\n\t"Content-Length"\n]',
        );
      }
    });
  });

  describe('Raw', async () => {
    it('renders basic response', async () => {
      const requests = [{ _id: 'req_1', parentId: 'wrk_1' }];

      const responses = [
        {
          _id: 'res_1',
          parentId: 'req_1',
          statusCode: 200,
          contentType: 'text/plain',
          _body: 'Hello World!',
        },
      ];

      const context = _genTestContext(requests, responses);

      expect(await tag.run(context, 'raw', 'req_1')).toBe('Hello World!');
    });
  });
});

function _genTestContext(requests, responses) {
  requests = requests || [];
  responses = responses || [];
  const bodies = {};
  for (const res of responses) {
    bodies[res._id] = res._body || null;
    delete res._body;
  }
  return {
    util: {
      models: {
        request: {
          getById(requestId) {
            return requests.find(r => r._id === requestId) || null;
          },
        },
        response: {
          getLatestForRequestId(requestId) {
            return responses.find(r => r.parentId === requestId) || null;
          },
          getBodyBuffer(response) {
            const strOrBuffer = bodies[response._id];

            if (typeof strOrBuffer === 'string') {
              return Buffer.from(strOrBuffer);
            }

            if (!strOrBuffer) {
              return null;
            }

            return strOrBuffer;
          },
        },
      },
    },
  };
}
