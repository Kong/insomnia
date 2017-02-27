import jq from 'jsonpath';
import * as models from '../../models';

import BaseExtension from './base/BaseExtension';

const TAG_NAME = 'response';
const TAG_NAME_SHORT = 'res';

const FIELD_BODY = ['body', 'b'];

export default class ResponseExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = [TAG_NAME, TAG_NAME_SHORT];
  }

  async run (context, field, id, query) {
    if (!FIELD_BODY.includes(field)) {
      throw new Error(`Invalid response field ${field}`);
    }

    const request = await models.request.getById(id);
    if (!request) {
      throw new Error(`Could not find request ${id}`);
    }

    const response = await models.response.getLatestForRequest(id);

    if (!response) {
      throw new Error(`No responses for request ${id}`);
    }

    const bodyBuffer = new Buffer(response.body, response.encoding);
    const bodyStr = bodyBuffer.toString();

    let body;
    try {
      body = JSON.parse(bodyStr);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }

    let results;
    try {
      results = jq.query(body, query);
    } catch (err) {
      throw new Error(`Invalid JSONPath query: ${query}`)
    }

    if (results.length === 0) {
      throw new Error(`Returned no results: ${query}`)
    } else if (results.length > 1) {
      throw new Error(`Returned more than one result: ${query}`)
    }

    return `${results[0] || ''}`;
  }
}
