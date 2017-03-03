import * as templating from '../../index';
import * as db from '../../../common/database';
import * as models from '../../../models';

describe('ResponseExtension', async () => {
  beforeEach(() => db.init(models.types(), {inMemoryOnly: true}, true));

  it('renders basic response "body", query', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({parentId: request._id, body: '{"foo": "bar"}'});

    const result = await templating.render(`{% response "body", "${request._id}", "$.foo" %}`);

    expect(result).toBe('bar');
  });

  it('fails on invalid JSON', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({parentId: request._id, body: '{"foo": "bar"'});

    try {
      await templating.render(`{% response "body", "${request._id}", "$.foo" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Invalid JSON: Unexpected end of JSON input');
    }
  });

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
    await models.response.create({parentId: 'req_test', body: '{"foo": "bar"}'});

    try {
      await templating.render(`{% response "body", "req_test", "$.foo" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Could not find request req_test');
    }
  });

  it('fails on invalid query', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({parentId: request._id, body: '{"foo": "bar"}'});

    try {
      await templating.render(`{% response "body", "${request._id}", "$$" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Invalid JSONPath query: $$');
    }
  });

  it('fails on no results', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({parentId: request._id, body: '{"foo": "bar"}'});

    try {
      await templating.render(`{% response "body", "${request._id}", "$.missing" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Returned no results: $.missing');
    }
  });

  it('fails on more than 1 result', async () => {
    const request = await models.request.create({parentId: 'foo'});
    await models.response.create({parentId: request._id, body: '{"array": [1,2,3]}'});

    try {
      await templating.render(`{% response "body", "${request._id}", "$.array.*" %}`);
      fail('JSON should have failed to parse');
    } catch (err) {
      expect(err.message).toContain('Returned more than one result: $.array.*');
    }
  });
});
