'use strict';

const crypto = require('crypto');
const utils = require('../utils');
const SwaggerParser = require('swagger-parser');
const SUPPORTED_SWAGGER_VERSION = '2.0';
const MIMETYPE_JSON = 'application/json';
const MIMETYPE_URLENCODED = 'application/x-www-form-urlencoded';
const MIMETYPE_MULTIPART = 'multipart/form-data';
const SUPPORTED_MIME_TYPES = [MIMETYPE_JSON, MIMETYPE_URLENCODED, MIMETYPE_MULTIPART];
const WORKSPACE_ID = '__WORKSPACE_ID__';

let requestCount = 1;

module.exports.id = 'swagger2';
module.exports.name = 'Swagger 2.0';
module.exports.description = 'Importer for Swagger 2.0 specification (json/yaml)';

module.exports.convert = async function(rawData) {
  requestCount = 1;

  // Validate
  let api = await parseDocument(rawData);
  if (!api || api.swagger !== SUPPORTED_SWAGGER_VERSION) {
    return null;
  }

  // Await here so we catch any exceptions
  try {
    api = await SwaggerParser.validate(api);
  } catch (err) {
    // We already know it's a Swagger doc so we will try to import it anyway instead
    // of bailing out here.
    console.log('[swagger] Import file validation failed', err);
  }

  // Import
  const workspace = {
    _type: 'workspace',
    _id: WORKSPACE_ID,
    parentId: null,
    name: `${api.info.title} ${api.info.version}`,
    description: api.info.description || '',
    // scope is not set because it could be imported for design OR to generate requests
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

  const swaggerEnv = {
    _type: 'environment',
    _id: 'env___BASE_ENVIRONMENT_ID___sub',
    parentId: baseEnv._id,
    name: 'Swagger env',
    data: {
      base_path: api.basePath || '',
      scheme: (api.schemes || ['http'])[0],
      host: api.host || '',
    },
  };

  const endpoints = parseEndpoints(api);

  return [workspace, baseEnv, swaggerEnv, ...endpoints];
};

/**
 * Parse string data into swagger 2.0 object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swagger-object)
 *
 * @param {string} rawData
 *
 * @returns {Object|null} Swagger 2.0 object
 */
async function parseDocument(rawData) {
  try {
    return utils.unthrowableParseJson(rawData) || SwaggerParser.YAML.parse(rawData);
  } catch (err) {
    return null;
  }
}

/**
 * Create request definitions based on swagger document.
 *
 * @param {Object} document - Swagger 2.0 valid object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swagger-object)
 *
 * @returns {Object[]} array of insomnia endpoints definitions
 */
function parseEndpoints(document) {
  const defaultParent = WORKSPACE_ID;
  const globalMimeTypes = document.consumes;

  const paths = Object.keys(document.paths);
  const endpointsSchemas = paths
    .map(path => {
      const schemasPerMethod = document.paths[path];
      const methods = Object.keys(schemasPerMethod);

      return methods
        .filter(method => method !== 'parameters')
        .map(method => Object.assign({}, schemasPerMethod[method], { path, method }));
    })
    .reduce((flat, arr) => flat.concat(arr), []); // flat single array

  const tags = document.tags || [];

  const implicitTags = endpointsSchemas
    .map(endpointSchema => endpointSchema.tags)
    .reduce((flat, arr) => flat.concat(arr), []) // flat single array
    .reduce((distinct, value) => {
      if (!distinct.includes(value)) {
        distinct.push(value);
      }
      return distinct;
    }, []) // remove duplicates
    .filter(tag => !tags.map(tag => tag.name).includes(tag))
    .map(tag => ({
      name: tag,
      desciption: '',
    }));

  const folders = [...tags, ...implicitTags].map(tag => {
    return importFolderItem(tag, defaultParent);
  });
  const folderLookup = {};
  folders.forEach(folder => (folderLookup[folder.name] = folder._id));

  const requests = [];
  endpointsSchemas.map(endpointSchema => {
    let { tags } = endpointSchema;
    if (!tags || tags.length === 0) tags = [''];
    tags.forEach((tag, index) => {
      const id = endpointSchema.operationId
        ? `${endpointSchema.operationId}${index > 0 ? index : ''}`
        : `__REQUEST_${requestCount++}__`;
      const parentId = folderLookup[tag] || defaultParent;
      requests.push(importRequest(document, endpointSchema, globalMimeTypes, id, parentId));
    });
  });

  return [...folders, ...requests];
}

/**
 * Return Insomnia folder / request group
 *
 *
 * @param {Object} item - swagger 2.0 endpoint schema
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
    name: item.name || 'Folder {requestGroupCount}',
    description: item.description || '',
  };
}

/**
 * Return Insomnia request
 *
 * @param {Object} schema - swagger 2.0 schema
 * @param {Object} endpointSchema - swagger 2.0 endpoint schema
 * @param {string[]} globalMimeTypes - list of mimeTypes available in document globally (i.e. document.consumes)
 * @param {string} id - id to be given to current request
 * @param {string} parentId - id of parent category
 * @returns {Object}
 */

function importRequest(schema, endpointSchema, globalMimeTypes, id, parentId) {
  const name = endpointSchema.summary || `${endpointSchema.method} ${endpointSchema.path}`;
  const request = {
    _type: 'request',
    _id: id,
    parentId: parentId,
    name,
    method: endpointSchema.method.toUpperCase(),
    url: '{{ base_url }}' + pathWithParamsAsVariables(endpointSchema.path),
    body: prepareBody(schema, endpointSchema, globalMimeTypes),
    description: endpointSchema.description || '',
    headers: prepareHeaders(endpointSchema),
    parameters: prepareQueryParams(endpointSchema),
  };

  if (request.body.mimeType && !request.headers.find(header => header.name === 'Content-Type')) {
    request.headers = [
      {
        name: 'Content-Type',
        disabled: false,
        value: request.body.mimeType,
      },
    ].concat(request.headers);
  }

  return setupAuthentication(schema.securityDefinitions, endpointSchema, request);
}

/**
 * Populate Insomnia request with authentication
 *
 * @param {Object} securityDefinitions - swagger 2.0 security definitions
 * @param {Object} endpointSchema - swagger 2.0 endpoint schema
 * @param {Object} request - insomnia request object
 * @returns {Object}
 */
function setupAuthentication(securityDefinitions, endpointSchema, request) {
  if (!securityDefinitions) {
    return request;
  }
  if (endpointSchema.security && endpointSchema.security.length > 0) {
    const usedDefinitions = endpointSchema.security.reduce(
      (collect, obj) => collect.concat(...Object.keys(obj)),
      [],
    );
    const scopes = endpointSchema.security.reduce((scopes, security) => {
      for (const defname of Object.keys(security)) {
        if (security[defname].length === 0) {
          continue;
        }
        return scopes.concat(security[defname]);
      }
      return scopes;
    }, []);
    for (const usedDefinition of usedDefinitions) {
      const definition = securityDefinitions[usedDefinition];
      if (definition.type === 'basic') {
        request.authentication = {
          type: 'basic',
          disabled: false,
          password: '{{ password }}',
          username: '{{ username }}',
        };
      }
      if (definition.type === 'apiKey') {
        if (definition.in === 'header') {
          request.headers.push({
            name: definition.name,
            disabled: false,
            value: '{{ api_key }}',
          });
        }
        if (definition.in === 'query') {
          request.parameters.push({
            name: definition.name,
            disabled: false,
            value: '{{ api_key }}',
          });
        }
      }
      if (definition.type === 'oauth2') {
        if (definition.flow === 'implicit') {
          request.authentication = {
            type: 'oauth2',
            grantType: 'authorization_code',
            disabled: false,
            authorizationUrl: definition.authorizationUrl,
            clientId: '{{ client_id }}',
            scope: scopes.join(' '),
          };
        }
        if (definition.flow === 'password') {
          request.authentication = {
            type: 'oauth2',
            grantType: 'password',
            disabled: false,
            accessTokenUrl: definition.tokenUrl,
            username: '{{ username }}',
            password: '{{ password }}',
            clientId: '{{ client_id }}',
            clientSecret: '{{ client_secret }}',
            scope: scopes.join(' '),
          };
        }
        if (definition.flow === 'application') {
          request.authentication = {
            type: 'oauth2',
            grantType: 'client_credentials',
            disabled: false,
            accessTokenUrl: definition.tokenUrl,
            clientId: '{{ client_id }}',
            clientSecret: '{{ client_secret }}',
            scope: scopes.join(' '),
          };
        }
        if (definition.flow === 'accessCode') {
          request.authentication = {
            type: 'oauth2',
            grantType: 'authorization_code',
            disabled: false,
            accessTokenUrl: definition.tokenUrl,
            authorizationUrl: definition.authorizationUrl,
            clientId: '{{ client_id }}',
            clientSecret: '{{ client_secret }}',
            scope: scopes.join(' '),
          };
        }
      }
    }
  }
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
 * @param {Object} endpointSchema - swagger 2.0 endpoint schema
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
 * @param {Object} endpointSchema - swagger 2.0 endpoint schema
 * @returns {Object[]} array of parameters definitions
 */
function prepareHeaders(endpointSchema) {
  const isSendInHeader = p => p.in === 'header';
  const parameters = endpointSchema.parameters || [];
  const headerParameters = parameters.filter(isSendInHeader);
  return convertParameters(headerParameters);
}

function resolve$ref(schema, $ref) {
  const parts = $ref.split('/');
  parts.shift(); // remove #
  return parts.reduce((doc, path) => doc[path], schema);
}

/**
 * Imports insomnia request body definitions, including data mock (if available)
 *
 * If multiple types are available, the one for which an example can be generated will be selected first (i.e. application/json)
 *
 * @param {Object} schema - swagger 2.0 schema
 * @param {Object} endpointSchema - swagger 2.0 endpoint schema
 * @param {string[]} globalMimeTypes - list of mimeTypes available in document globally (i.e. document.consumes)
 *
 * @return {Object} insomnia request's body definition
 */
function prepareBody(schema, endpointSchema, globalMimeTypes) {
  const mimeTypes = endpointSchema.consumes || globalMimeTypes || [];
  const isAvailable = m => mimeTypes.includes(m);
  const supportedMimeType = SUPPORTED_MIME_TYPES.find(isAvailable);
  if (supportedMimeType === MIMETYPE_JSON) {
    const isSendInBody = p => p.in === 'body';
    const parameters = endpointSchema.parameters || [];
    const bodyParameter = parameters.find(isSendInBody);
    if (!bodyParameter) {
      return {};
    }

    const type = bodyParameter.type || 'object';
    const example = generateParameterExample(type);
    let text;
    if (type === 'object') {
      if (bodyParameter.schema.$ref) {
        const definition = resolve$ref(schema, bodyParameter.schema.$ref);
        text = JSON.stringify(example(definition), null, 2);
      } else {
        text = JSON.stringify(example(bodyParameter.schema), null, 2);
      }
    } else {
      text = JSON.stringify(example, null, 2);
    }

    return {
      mimeType: supportedMimeType,
      text,
    };
  }

  if (supportedMimeType === MIMETYPE_URLENCODED || supportedMimeType === MIMETYPE_MULTIPART) {
    const isSendInFormData = p => p.in === 'formData';
    const parameters = endpointSchema.parameters || [];
    const formDataParameters = parameters.filter(isSendInFormData);

    if (formDataParameters.length === 0) {
      return {};
    }
    return {
      mimeType: supportedMimeType,
      params: convertParameters(formDataParameters),
    };
  }

  if (mimeTypes && mimeTypes.length) {
    return {
      mimeType: mimeTypes[0] || undefined,
    };
  } else {
    return {};
  }
}

/**
 * Converts swagger schema of parametes into insomnia one.
 *
 * @param {Object[]} parameters - array of swagger schemas of parameters
 * @returns {Object[]} array of insomnia parameters definitions
 */
function convertParameters(parameters) {
  return parameters.map(parameter => {
    const { required, name, type } = parameter;
    if (type === 'file') {
      return {
        name,
        disabled: required !== true,
        type: 'file',
      };
    }
    return {
      name,
      disabled: required !== true,
      value: `${generateParameterExample(parameter)}`,
    };
  });
}

/**
 * Generate example value of parameter based on it's schema.
 * Returns example / default value of the parameter, if any of those are defined. If not, returns value based on parameter type.
 *
 * @param {string|Object} schema - Swagger 2.0 parameter definition object
 * (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#parametersDefinitionsObject) or string with valid parameter type
 *
 * @returns {*}
 */
function generateParameterExample(schema, ancestors = []) {
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
      if (ancestors.indexOf(schema) !== -1) {
        return example;
      }
      if (properties) {
        ancestors.push(schema);
        Object.keys(properties).forEach(propertyName => {
          example[propertyName] = generateParameterExample(properties[propertyName], ancestors);
        });
        ancestors.pop();
      }

      return example;
    },
    array: schema => {
      const value = generateParameterExample(schema.items, ancestors);
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
    const { type, format, example, default: defaultValue } = schema;

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
