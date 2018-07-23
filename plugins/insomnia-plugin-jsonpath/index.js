const jq = require('jsonpath');

module.exports.templateTags = [
  {
    displayName: 'JSONPath',
    name: 'jsonpath',
    description: 'pull data from JSON strings with JSONPath',
    args: [
      {
        displayName: 'JSON string',
        type: 'string'
      },
      {
        displayName: 'JSONPath Filter',
        type: 'string'
      }
    ],
    run(context, jsonString, filter) {
      let body;
      try {
        body = JSON.parse(jsonString);
      } catch (err) {
        throw new Error(`Invalid JSON: ${err.message}`);
      }

      let results;
      try {
        results = jq.query(body, filter);
      } catch (err) {
        throw new Error(`Invalid JSONPath query: ${filter}`);
      }

      if (results.length === 0) {
        throw new Error(`JSONPath query returned no results: ${filter}`);
      }

      return results[0];
    }
  }
];
