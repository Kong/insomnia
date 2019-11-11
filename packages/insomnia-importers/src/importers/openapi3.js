'use strict';

const crypto = require('crypto');

const SwaggerParser = require('swagger-parser');
const URL = require('url').URL;
const utils = require('../utils');

const SUPPORTED_OPENAPI_VERSION = /^3\.\d+\.\d+$/; // 3.x.x
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_LITERALLY_ANYTHING = '*/*';
const SUPPORTED_MIME_TYPES = [MIMETYPE_JSON, MIMETYPE_LITERALLY_ANYTHING];
const WORKSPACE_ID = '__WORKSPACE_ID__';
const SECURITY_TYPE = {
  HTTP: 'http',
  API_KEY: 'apiKey',
  OAUTH: 'oauth2',
  OPEN_ID: 'openIdConnect',
};
const SUPPORTED_SECURITY_TYPES = [SECURITY_TYPE.HTTP, SECURITY_TYPE.API_KEY];

let requestCounts = {};

module.exports.id = 'openapi3';
module.exports.name = 'OpenAPI 3.0';
module.exports.description = 'Importer for OpenAPI 3.0 specification (json/yaml)';

module.exports.convert = async function(rawData) {
  // Reset
  requestCounts = {};

  // Validate
  let api = await parseDocument(rawData);
  if (!api || !SUPPORTED_OPENAPI_VERSION.test(api.openapi)) {
    return null;
  }

  try {
    api = await SwaggerParser.validate(api);
  } catch (err) {
    console.log('[openapi3] Import file validation failed', err);
  }

  // Import
  const workspace = {
    _type: 'workspace',
    _id: WORKSPACE_ID,
    parentId: null,
    name: `${api.info.title} ${api.info.version}`,
    description: api.info.description || '',
  };

  const baseEnv = {
    _type: 'environment',
    _id: '__BASE_ENVIRONMENT_ID__',
    parentId: WORKSPACE_ID,
    name: 'Base environment',
    data: {
      base_url: '{{ scheme }}://{{ host }}{{ base_path }}',
    },
  };

  const servers = api.servers.map(s => new URL(s.url));
  const defaultServer = servers[0] || new URL('http://example.com/');
  const securityVariables = getSecurityEnvVariables(
    api.components && api.components.securitySchemes,
  );

  const openapiEnv = {
    _type: 'environment',
    _id: `env___BASE_ENVIRONMENT_ID___sub`,
    parentId: baseEnv._id,
    name: 'OpenAPI env',
    data: {
      base_path: defaultServer.pathname || '',
      scheme: defaultServer.protocol.replace(/:$/, '') || ['http'], // note: `URL.protocol` returns with trailing `:` (i.e. "https:")
      host: defaultServer.host || '',
      ...securityVariables,
    },
  };

  const endpoints = parseEndpoints(api);

  return [workspace, baseEnv, openapiEnv, ...endpoints];
};

/**
 * Parse string data into openapi 3 object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#oasObject)
 *
 * @param {string} rawData
 *
 * @returns {Promise<Object|null>} OpenAPI 3 object
 */
async function parseDocument(rawData) {
  try {
    return utils.unthrowableParseJson(rawData) || SwaggerParser.YAML.parse(rawData);
  } catch (err) {
    return null;
  }
}

/**
 * Create request definitions based on openapi document.
 *
 * @param {Object} document - OpenAPI 3 valid object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#oasObject)
 *
 * @returns {Object[]} array of insomnia endpoints definitions
 */
function parseEndpoints(document) {
  const rootSecurity = document.security;
  const securitySchemes = document.components ? document.components.securitySchemes : {};
  const defaultParent = WORKSPACE_ID;

  const paths = Object.keys(document.paths);
  const endpointsSchemas = paths
    .map(path => {
      const schemasPerMethod = document.paths[path];
      const methods = Object.keys(schemasPerMethod);

      return methods
        .filter(method => method !== 'parameters')
        .map(method => Object.assign({}, schemasPerMethod[method], { path, method }));
    })
    .reduce(
      // flat single array
      (flat, arr) => flat.concat(arr),
      [],
    );

  const tags = document.tags || [];
  const folders = tags.map(tag => {
    return importFolderItem(tag, defaultParent);
  });
  const folderLookup = {};
  folders.forEach(folder => (folderLookup[folder.name] = folder._id));

  const requests = [];
  endpointsSchemas.map(endpointSchema => {
    let { tags } = endpointSchema;

    if (!tags || tags.length === 0) {
      tags = [''];
    }

    for (const tag of tags) {
      const parentId = folderLookup[tag] || defaultParent;
      const resolvedSecurity = endpointSchema.security || rootSecurity;
      requests.push(importRequest(endpointSchema, parentId, resolvedSecurity, securitySchemes));
    }
  });

  return [...folders, ...requests];
}

/**
 * Return Insomnia folder / request group
 *
 *
 * @param {Object} item - OpenAPI 3 endpoint schema
 * @param {string} parentId - id of parent category
 * @returns {Object}
 */
function importFolderItem(item, parentId) {
  const hash = crypto
    .createHash('sha1')
    .update(item.name)
    .digest('hex')
    .slice(0, 8);
  return {
    parentId,
    _id: `fld___WORKSPACE_ID__${hash}`,
    _type: 'request_group',
    name: item.name || `Folder {requestGroupCount}`,
    description: item.description || '',
  };
}

/**
 * Return Insomnia request
 *
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 * @param {string} parentId - id of parent category
 * @param {Object} security - OpenAPI 3 security rules
 * @param {Object} securitySchemes - OpenAPI 3 security schemes
 * @returns {Object}
 */
function importRequest(endpointSchema, parentId, security, securitySchemes) {
  const name = endpointSchema.summary || endpointSchema.path;
  const id = generateUniqueRequestId(endpointSchema);
  const paramHeaders = prepareHeaders(endpointSchema);
  const { authentication, headers: securityHeaders, parameters: securityParams } = parseSecurity(
    security,
    securitySchemes,
  );

  const request = {
    _type: 'request',
    _id: id,
    parentId: parentId,
    name,
    method: endpointSchema.method.toUpperCase(),
    url: '{{ base_url }}' + pathWithParamsAsVariables(endpointSchema.path),
    body: prepareBody(endpointSchema),
    headers: [...paramHeaders, ...securityHeaders],
    authentication,
    parameters: [...prepareQueryParams(endpointSchema), ...securityParams],
  };

  return request;
}

/**
 * Return path with parameters replaced by insomnia variables
 *
 * I.e. "/foo/:bar" => "/foo/{{ bar }}"
 *
 * @param {string} path
 * @returns {string}
 */
function pathWithParamsAsVariables(path) {
  return path.replace(/{([^}]+)}/g, '{{ $1 }}');
}

/**
 * Imports insomnia definitions of query parameters.
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 * @returns {Object[]} array of parameters definitions
 */
function prepareQueryParams(endpointSchema) {
  const isSendInQuery = p => p.in === 'query';
  const parameters = endpointSchema.parameters || [];
  const queryParameters = parameters.filter(isSendInQuery);
  return convertParameters(queryParameters);
}

/**
 * Imports insomnia definitions of header parameters.
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 * @returns {Object[]} array of parameters definitions
 */
function prepareHeaders(endpointSchema) {
  const isSendInHeader = p => p.in === 'header';
  const parameters = endpointSchema.parameters || [];
  const headerParameters = parameters.filter(isSendInHeader);
  return convertParameters(headerParameters);
}

/**
 * Parse OpenAPI 3 securitySchemes into insomnia definitions of authentication, headers and parameters
 *
 * @param {Object} security - OpenAPI 3 security rules
 * @param {Object} securitySchemes - OpenAPI 3 security schemes
 * @returns {Object} headers or basic http authentication details
 */
function parseSecurity(security, securitySchemes) {
  if (!security || !securitySchemes) {
    return {
      authentication: {},
      headers: [],
      parameters: [],
    };
  }

  const supportedSchemes = security
    .map(securityPolicy => {
      const securityName = Object.keys(securityPolicy)[0];
      return securitySchemes[securityName];
    })
    .filter(schemeDetails => SUPPORTED_SECURITY_TYPES.includes(schemeDetails.type));

  const apiKeySchemes = supportedSchemes.filter(scheme => scheme.type === SECURITY_TYPE.API_KEY);
  const apiKeyHeaders = apiKeySchemes
    .filter(scheme => scheme.in === 'header')
    .map(scheme => {
      return {
        name: scheme.name,
        disabled: false,
        value: '{{ apiKey }}',
      };
    });
  const apiKeyCookies = apiKeySchemes
    .filter(scheme => scheme.in === 'cookie')
    .map(scheme => `${scheme.name}={{ apiKey }}`);
  const apiKeyCookieHeader = { name: 'Cookie', disabled: false, value: apiKeyCookies.join('; ') };
  const apiKeyParams = apiKeySchemes
    .filter(scheme => scheme.in === 'query')
    .map(scheme => {
      return {
        name: scheme.name,
        disabled: false,
        value: '{{ apiKey }}',
      };
    });

  if (apiKeyCookies.length > 0) {
    apiKeyHeaders.push(apiKeyCookieHeader);
  }

  const httpAuth = supportedSchemes.find(
    scheme => scheme.type === SECURITY_TYPE.HTTP && scheme.scheme === 'basic',
  )
    ? { type: 'basic', username: '{{ httpUsername }}', password: '{{ httpPassword }}' }
    : {};

  return {
    authentication: httpAuth,
    headers: apiKeyHeaders,
    parameters: apiKeyParams,
  };
}

/**
 * Get Insomnia environment variables for OpenAPI securitySchemes
 *
 * @param {Object} securitySchemes - Open API security schemes
 * @returns {Object} Insomnia environment variables containing security information
 */
function getSecurityEnvVariables(securitySchemes) {
  if (!securitySchemes) {
    return {};
  }

  const variables = {};
  const securitySchemesArray = Object.values(securitySchemes);
  const hasApiKeyScheme = securitySchemesArray.some(
    scheme => scheme.type === SECURITY_TYPE.API_KEY,
  );
  const hasHttpScheme = securitySchemesArray.some(scheme => scheme.type === SECURITY_TYPE.HTTP);

  if (hasApiKeyScheme) {
    variables.apiKey = 'apiKey';
  }

  if (hasHttpScheme) {
    variables.httpUsername = 'username';
    variables.httpPassword = 'password';
  }

  return variables;
}

/**
 * Imports insomnia request body definitions, including data mock (if available)
 *
 * If multiple types are available, the one for which an example can be generated will be selected first (i.e. application/json)
 *
 * @param {Object} endpointSchema - OpenAPI 3 endpoint schema
 *
 * @return {Object} insomnia request's body definition
 */
function prepareBody(endpointSchema) {
  // request
  const requestBody = endpointSchema.requestBody || {};
  const content = requestBody.content || {};
  const mimeTypes = Object.keys(content);

  const isAvailable = m => mimeTypes.includes(m);
  const supportedMimeType = SUPPORTED_MIME_TYPES.find(isAvailable);

  if (supportedMimeType === MIMETYPE_JSON) {
    const bodyParameter = content[supportedMimeType];

    if (bodyParameter == null) {
      return {
        mimeType: MIMETYPE_JSON,
      };
    }

    const example = generateParameterExample(bodyParameter.schema);
    const text = JSON.stringify(example, null, 2);
    return {
      mimeType: MIMETYPE_JSON,
      text,
    };
  }

  if (mimeTypes && mimeTypes.length && mimeTypes[0] !== MIMETYPE_LITERALLY_ANYTHING) {
    return {
      mimeType: mimeTypes[0] || undefined,
    };
  } else {
    return {};
  }
}

/**
 * Converts openapi schema of parametes into insomnia one.
 *
 * @param {Object[]} parameters - array of OpenAPI schemas of parameters
 * @returns {Object[]} array of insomnia parameters definitions
 */
function convertParameters(parameters) {
  return parameters.map(parameter => {
    const { required, name, schema } = parameter;
    return {
      name,
      disabled: required !== true,
      value: `${generateParameterExample(schema)}`,
    };
  });
}

/**
 * Generate example value of parameter based on it's schema.
 * Returns example / default value of the parameter, if any of those are defined. If not, returns value based on parameter type.
 *
 * @param {string|Object} schema - OpenAPI 3 parameter definition object
 * (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#parameterObject) or string with valid parameter type
 *
 * @returns {*}
 */
function generateParameterExample(schema) {
  const typeExamples = {
    string: () => 'string',
    string_email: () => 'user@example.com',
    'string_date-time': () => new Date().toISOString(),
    string_byte: () => 'ZXhhbXBsZQ==',
    number: () => 0,
    number_float: () => 0.0,
    number_double: () => 0.0,
    integer: () => 0,
    boolean: () => true,
    object: schema => {
      const example = {};
      const { properties } = schema;

      Object.keys(properties).forEach(propertyName => {
        example[propertyName] = generateParameterExample(properties[propertyName]);
      });

      return example;
    },
    array: schema => {
      const value = generateParameterExample(schema.items);
      if (schema.collectionFormat === 'csv') {
        return value;
      } else {
        return [value];
      }
    },
  };

  if (typeof schema === 'string') {
    return typeExamples[schema];
  }

  if (schema instanceof Object) {
    const { type, format, example, readOnly, default: defaultValue } = schema;

    if (readOnly) {
      return undefined;
    }

    if (example) {
      return example;
    }

    if (defaultValue) {
      return defaultValue;
    }

    const factory = typeExamples[`${type}_${format}`] || typeExamples[type];

    if (!factory) {
      return null;
    }

    return factory(schema);
  }
}

/**
 * Generates a unique and deterministic request ID based on the endpoint schema
 *
 * @param endpointSchema
 */
function generateUniqueRequestId(endpointSchema) {
  // `operationId` is unique already, so we can just use that, combined with the ID
  // of the workspace to get something globally unique
  const uniqueKey = endpointSchema.operationId
    ? `${endpointSchema.operationId}`
    : `[${endpointSchema.method}]${endpointSchema.path}`;

  const hash = crypto
    .createHash('sha1')
    .update(uniqueKey)
    .digest('hex')
    .slice(0, 8);

  // Suffix the ID with a counter in case we try creating two with the same hash
  if (requestCounts.hasOwnProperty(hash)) {
    requestCounts[hash]++;
  } else {
    requestCounts[hash] = 0;
  }

  return `req_${WORKSPACE_ID}${hash}${requestCounts[hash] || ''}`;
}
