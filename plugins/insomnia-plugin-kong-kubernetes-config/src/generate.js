const YAML = require('yaml');
const o2k = require('openapi-2-kong');

module.exports = {
  label: 'Kong for Kubernetes',
  docsLink: 'https://docs.insomnia.rest/insomnia/kong-for-kubernetes',
  generate: async ({ contents, formatVersion }) => {
    const isSupported = formatVersion && formatVersion.match(/^3./);

    if (!isSupported) {
      return {
        document: null,
        error: `Unsupported OpenAPI spec format ${formatVersion}`,
      };
    }

    try {
      const result = await o2k.generateFromString(contents, 'kong-for-kubernetes');
      const yamlDocs = result.documents.map(d => YAML.stringify(d));

      return {
        // Join the YAML docs with "---" and strip any extra newlines surrounding them
        document: yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n'),
        error: null,
      };
    } catch (err) {
      return {
        document: null,
        error: err.message,
      };
    }
  },
};
