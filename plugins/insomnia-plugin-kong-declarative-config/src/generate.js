const YAML = require('yaml');
const o2k = require('openapi-2-kong');

module.exports = {
  label: 'Declarative Config',
  docsLink: 'https://docs.insomnia.rest/insomnia/kong-for-kubernetes',
  generate: async ({ contents, format, formatVersion }) => {
    const isSupported = format === 'openapi' && formatVersion.match(/^3./);
    const capitalisedInitial = format?.replace(/^\w/, c => c.toUpperCase());
    const capitalisedFormat = format === 'openapi' ? 'OpenAPI' : capitalisedInitial;
    // Return to signify that it's not supported
    if (!isSupported) {
      return {
        document: null,
        error: `Unsupported spec format ${capitalisedFormat} ${formatVersion}`,
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
