import jq from 'jsonpath';

// The context type should come from a standalone package which publishes plugin type definitions
type Context = unknown;

export const templateTags = [
  {
    displayName: 'JSONPath',
    name: 'jsonpath',
    description: 'pull data from JSON strings with JSONPath',
    args: [
      {
        displayName: 'JSON string',
        type: 'string',
      },
      {
        displayName: 'JSONPath Filter',
        encoding: 'base64', // So it doesn't cause syntax errors
        type: 'string',
      },
    ],
    run(_: Context, jsonString: string, filter: string) {
      let body;
      try {
        body = JSON.parse(jsonString);
      } catch (err) {
        if (err instanceof Error) {
          throw new Error(`Invalid JSON: ${err.message}`);
        } else {
          throw err;
        }
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
    },
  },
];
