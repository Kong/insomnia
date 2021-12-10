const o2k = require('openapi-2-kong');

module.exports = {
  label: 'Declarative Config',
  docsLink: 'https://docs.insomnia.rest/insomnia/declarative-config',
  generate: async ({ contents, formatVersion }) => {
    const isSupported = formatVersion && formatVersion.match(/^3./);

    if (!isSupported) {
      return {
        document: null,
        error: `Unsupported OpenAPI spec format ${formatVersion}`,
      };
    }

    try {
      const result = await o2k.generateFromString(contents, 'kong-declarative-config');
      // We know for certain the result.documents has only one entry for declarative config: packages/openapi-2-kong/src/declarative-config/generate.ts#L20
      const declarativeConfig = result.documents?.[0]
      return {
        document: JSON.stringify(declarativeConfig, null, '\t'),
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
