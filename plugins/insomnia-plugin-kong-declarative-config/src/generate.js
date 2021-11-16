const YAML = require('yaml');
const o2k = require('openapi-2-kong');

module.exports = {
  label: 'Declarative Config',
  generate: async ({ contents, openapiVersion }) => {
    const isSupported = openapiVersion && openapiVersion.match(/^3./);

    // Return to signify that it's not supported
    if (!isSupported) {
      return {
        document: null,
        error: `Unsupported OpenAPI spec format ${openapiVersion}`,
      };
    }

    let result;

    try {
      result = await o2k.generateFromString(contents, 'kong-declarative-config');
    } catch (err) {
      return {
        document: null,
        error: err.message,
      };
    }
    
    // We know for certain the result.documents has only one entry for declarative config: packages/openapi-2-kong/src/declarative-config/generate.ts#L20
    const document = JSON.stringify(result.documents?.[0], null, '\t');

    return {
      document,
      error: null,
    };
  },
};
