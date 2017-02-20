import jq from 'jsonpath';
import * as models from '../../models';

import BaseExtension from './base/BaseExtension';

const TAG_NAME = 'JSONPath';

export default class ResponseJsonPathExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = [TAG_NAME];
  }

  async run (context, id, query) {
    const request = await models.request.getById(id);
    if (!request) {
      throw new Error(`[${TAG_NAME}] Could not find request ${id}`)
    }

    const response = await models.response.getLatestForRequest(id);

    if (!response) {
      throw new Error(`[${TAG_NAME}] No responses for request ${id}`);
    }

    const bodyBuffer = new Buffer(response.body, response.encoding);
    const bodyStr = bodyBuffer.toString();

    let body;
    try {
      body = JSON.parse(bodyStr);
    } catch (err) {
      throw new Error(`[${TAG_NAME}] Invalid JSON: ${err.message}`)
    }

    let results;
    try {
      results = jq.query(body, query);
    } catch (err) {
      throw new Error(`[${TAG_NAME}] Invalid JSONPath query: ${query}`)
    }

    if (results.length === 0) {
      throw new Error(`[${TAG_NAME}] Returned no results: ${query}`)
    } else if (results.length > 1) {
      throw new Error(`[${TAG_NAME}] Returned more than one result: ${query}`)
    }

    return `${results[0] || ''}`;
  }
}
