import * as templating from '../../index';
import * as models from '../../../models';
import {globalBeforeEach} from '../../../__jest__/before-each';

describe('ResponseExtension General', async () => {
  beforeEach(globalBeforeEach);
  it('fails on no responses', async () => {
    const request = await models.request.create({parentId: 'foo'});

    try {
      await templating.render(`{% response "body", "${request._id}", "$.foo" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('No responses for request');
    }
  });

  it('fails on no request', async () => {
    await models.response.create({parentId: 'req_test'}, '{"foo": "bar"}');

    try {
      await templating.render(`{% response "body", "req_test", "$.foo" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Could not find request req_test');
    }
  });

  it('fails on empty filter', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({parentId: request._id, statusCode: 200}, '{"foo": "bar"}');

    try {
      await templating.render(`{% response "body", "${request._id}", "" %}`);
      fail('Should have failed');
    } catch (err) {
      expect(err.message).toContain('No body filter specified');
    }
  });
});

describe('ResponseExtension JSONPath', async () => {
  beforeEach(globalBeforeEach);
  it('renders basic response "body", query', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '{"foo": "bar"}');

    const result = await templating.render(`{% response "body", "${request._id}", "$.foo" %}`);

    expect(result).toBe('bar');
  });

  it('fails on invalid JSON', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '{"foo": "bar"');

    try {
      await templating.render(`{% response "body", "${request._id}", "$.foo" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Invalid JSON: Unexpected end of JSON input');
    }
  });

  it('fails on invalid query', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '{"foo": "bar"}');

    try {
      await templating.render(`{% response "body", "${request._id}", "$$" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Invalid JSONPath query: $$');
    }
  });

  it('fails on no results', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '{"foo": "bar"}');

    try {
      await templating.render(`{% response "body", "${request._id}", "$.missing" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Returned no results: $.missing');
    }
  });

  it('fails on more than 1 result', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '{"array": [1,2,3]}');

    try {
      await templating.render(`{% response "body", "${request._id}", "$.array.*" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Returned more than one result: $.array.*');
    }
  });
});

describe('ResponseExtension XPath', async () => {
  beforeEach(globalBeforeEach);
  it('renders basic response "body" query', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '<foo><bar>Hello World!</bar></foo>');

    const result = await templating.render(`{% response "body", "${request._id}", "/foo/bar" %}`);

    expect(result).toBe('Hello World!');
  });

  it('renders basic response "body" attribute query', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '<foo><bar hello="World!">Hello World!</bar></foo>');

    const result = await templating.render(`{% response "body", "${request._id}", "/foo/bar/@hello" %}`);

    expect(result).toBe('World!');
  });

  it('no results on invalid XML', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '<hi></hi></sstr>');

    try {
      await templating.render(`{% response "body", "${request._id}", "/foo" %}`);
      fail('should have failed');
    } catch (err) {
      expect(err.message).toContain('Returned no results: /foo');
    }
  });

  it('fails on invalid query', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '<foo><bar>Hello World!</bar></foo>');

    try {
      await templating.render(`{% response "body", "${request._id}", "//" %}`);
      fail('should have failed');
    } catch (err) {
      expect(err.message).toContain('Invalid XPath query: //');
    }
  });

  it('fails on no results', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '<foo><bar>Hello World!</bar></foo>');

    try {
      await templating.render(`{% response "body", "${request._id}", "/missing" %}`);
      fail('should have failed');
    } catch (err) {
      expect(err.message).toContain('Returned no results: /missing');
    }
  });

  it('fails on more than 1 result', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, '<foo><bar>Hello World!</bar><bar>And again!</bar></foo>');

    try {
      await templating.render(`{% response "body", "${request._id}", "/foo/*" %}`);
      fail('should have failed');
    } catch (err) {
      expect(err.message).toContain('Returned more than one result: /foo/*');
    }
  });
});

describe('ResponseExtension Header', async () => {
  beforeEach(globalBeforeEach);
  it('renders basic response "header"', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200,
      headers: [
        {name: 'Content-Type', value: 'application/json'},
        {name: 'Content-Length', value: '20'}
      ]
    });

    const id = request._id;

    expect(await templating.render(`{% response "header", "${id}", "content-type" %}`))
      .toBe('application/json');
    expect(await templating.render(`{% response "header", "${id}", "Content-Type" %}`))
      .toBe('application/json');
    expect(await templating.render(`{% response "header", "${id}", "CONTENT-type" %}`))
      .toBe('application/json');
    expect(await templating.render(`{% response "header", "${id}", "  CONTENT-type  " %}`))
      .toBe('application/json');
  });

  it('no results on missing header', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200,
      headers: [
        {name: 'Content-Type', value: 'application/json'},
        {name: 'Content-Length', value: '20'}
      ]
    });

    try {
      await templating.render(`{% response "header", "${request._id}", "dne" %}`);
      fail('should have failed');
    } catch (err) {
      expect(err.message).toBe('No header with name "dne".\nChoices are [\n\t"Content-Type",\n\t"Content-Length"\n]');
    }
  });
});

describe('ResponseExtension Raw', async () => {
  beforeEach(globalBeforeEach);
  it('renders basic response "header"', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({
      parentId: request._id,
      statusCode: 200
    }, 'Hello World!');

    const result = await templating.render(`{% response "raw", "${request._id}", "" %}`);
    expect(result).toBe('Hello World!');
  });
});
