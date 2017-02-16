import jq from 'jsonpath';
import * as models from '../../models';

import BaseExtension from './base/BaseExtension';

export default class ResponseJsonPathExtension extends BaseExtension {
  constructor () {
    super();
    this.tags = ['res_jsonpath'];
  }

  async run (context, requestId, query) {
    // const request = await models.request.getById(requestId);
    const responses = await models.response.findRecentForRequest(requestId, 1);

    if (responses.length === 0) {
      throw new Error(`No responses for request ${requestId}`);
    }

    // TODO: Error handling
    const response = responses[0];

    const json = new Buffer(response.body, response.encoding).toString();
    const obj = JSON.parse(json);
    const results = jq.query(obj, query);

    if (results.length === 0) {
      throw new Error(`JSONPath query didn't return any results: ${query}`)
    } else if (results.length > 1) {
      throw new Error(`JSONPath query returned more than one result: ${query}`)
    }

    return `${results[0] || ''}`;
  }
}
