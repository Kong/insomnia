import jsonpath from 'jsonpath';

import { PluginTemplateFilter } from '../extensions';

const jsonPathFilter: PluginTemplateFilter = {
  name: 'jsonPath',
  displayName: 'JSON path filter',
  args: [
    {
      displayName: 'Filter',
      type: 'string',
      placeholder: 'Filter',
      defaultValue: '',
    },
  ],
  description: '',
  run: function(_ctx: any, value: string | object | any[], filter: string) {
    let body;
    try {
      if (typeof value === 'string') {
        body = JSON.parse(value);
      } else {
        body = value;
      }
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }

    let results;
    try {
      results = jsonpath.query(body, filter);
    } catch (err) {
      throw new Error(`Invalid JSONPath query: ${filter}`);
    }

    return JSON.stringify(results);
  },
};

export default jsonPathFilter;
