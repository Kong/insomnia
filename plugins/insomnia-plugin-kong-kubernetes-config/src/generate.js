const YAML = require('yaml');
const o2k = require('openapi-2-kong');

module.exports = {
  label: 'Kong for Kubernetes',
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
      result = await o2k.generateFromString(contents, 'kong-for-kubernetes');
    } catch (err) {
      return {
        document: null,
        error: err.message,
      };
    }

    const yamlDocs = result.documents.map(d => YAML.stringify(d));

    // Join the YAML docs with "---" and strip any extra newlines surrounding them
    const document = yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n');

    return {
      document,
      error: null,
    };
  },
};
