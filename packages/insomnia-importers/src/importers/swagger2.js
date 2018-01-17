const SwaggerParser = require('swagger-parser');

const SUPPORTED_SWAGGER_VERSION = '2.0';
const MIMETYPE_JSON = 'application/json';
const SUPPORTED_MIME_TYPES = [MIMETYPE_JSON];
const WORKSPACE_ID = '__WORKSPACE_1__';

module.exports.id = 'swagger2';
module.exports.name = 'Swagger 2.0';
module.exports.description = 'Importer for Swagger 2.0 specification (json/yaml)';

module.exports.convert = async function (rawData) {
  // Validate
  const api = await parseDocument(rawData);
  if (!api || api.swagger !== SUPPORTED_SWAGGER_VERSION) {
    return null;
  }

  // Import
  const workspace = {
    _type: 'workspace',
    _id: WORKSPACE_ID,
    parentId: null,
    name: `${api.info.title} ${api.info.version}`,
    description: api.info.description || ''
  };

  const baseEnv = {
    _type: 'environment',
    _id: '__ENV_1__',
    parentId: '__WORKSPACE_1__',
    name: 'Base environment',
    data: {
      base_url: '{{ scheme }}://{{ host }}{{ base_path }}'
    }
  };

  const swaggerEnv = {
    _type: 'environment',
    _id: '__ENV_2__',
    parentId: baseEnv._id,
    name: 'Swagger env',
    data: {
      base_path: api.basePath || '',
      scheme: (api.schemes || ["http"])[0],
      host: api.host || ''
    }
  };

  const endpoints = parseEndpoints(api);

  return [
    workspace,
    baseEnv,
    swaggerEnv,
    ...endpoints
  ];
};


/**
 * Parse string data into swagger 2.0 object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swagger-object)
 *
 * @param {string} rawData
 *
 * @returns {Object|null} Swagger 2.0 object
 */
async function parseDocument (rawData) {
  try {
    const api = unthrowableParseJson(rawData) || SwaggerParser.YAML.parse(rawData);
    if (!api) {
      return null;
    }

    // Await here so we catch any exceptions
    return await SwaggerParser.validate(api);
  } catch (err) {
    return null;
  }

  function unthrowableParseJson (rawData) {
    try {
      return JSON.parse(rawData)
    } catch (err) {
      return null;
    }
  }
}

/**
 * Create request definitions based on swagger document.
 *
 * @param {Object} document - Swagger 2.0 valid object (https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#swagger-object)
 *
 * @returns {Object[]} array of insomnia endpoints definitions
 */
function parseEndpoints (document) {
  const defaultParent = WORKSPACE_ID;
  const globalMimeTypes = document.consumes;

  const paths = Object.keys(document.paths);
  const endpointsSchemas = paths.map(path => {
    const schemasPerMethod = document.paths[path];
    const methods = Object.keys(schemasPerMethod);

    return methods.map(method => (
      Object.assign({}, schemasPerMethod[method], {path, method})
    ))
  }).reduce((flat, arr) => flat.concat(arr), []); //flat single array

  return endpointsSchemas.map((endpointSchema, index) => {
    let {path, method, operationId: _id, summary} = endpointSchema;
    const name = summary || `${method} ${path}`;

    return {
      _type: 'request',
      _id: endpointSchema.operationId || `__REQUEST_${index}__`,
      parentId: defaultParent,
      name,
      method: method.toUpperCase(),
      url: '{{ base_url }}' + pathWithParamsAsVariables(path),
      body: prepareBody(endpointSchema, globalMimeTypes),
      headers: prepareHeaders(endpointSchema),
      parameters: prepareQueryParams(endpointSchema)
    }
  });
}

/**
 * Return path with parameters replaced by insomnia variables
 *
 * I.e. "/foo/:bar" => "/foo/{{ bar }}"
 *
 * @param {string} path
 * @returns {string}
 */
function pathWithParamsAsVariables (path) {
  return path.replace(/{(.+)}/, '{{ $1 }}');
}

/**
 * Imports insomnia definitions of query parameters.
 *
 * @param {Object} endpointSchema - swagger 2.0 endpoint schema
 * @returns {Object[]} array of parameters definitions
 */
function prepareQueryParams (endpointSchema) {
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
function prepareHeaders (endpointSchema) {
  const isSendInHeader = p => p.in === 'header';
  const parameters = endpointSchema.parameters || [];
  const headerParameters = parameters.filter(isSendInHeader);
  return convertParameters(headerParameters);
}

/**
 * Imports insomnia request body definitions, including data mock (if available)
 *
 * If multiple types are available, the one for which an example can be generated will be selected first (i.e. application/json)
 *
 * @param {Object} endpointSchema - swagger 2.0 endpoint schema
 * @param {string[]} globalMimeTypes - list of mimeTypes available in document globally (i.e. document.consumes)
 *
 * @return {Object} insomnia request's body definition
 */
function prepareBody (endpointSchema, globalMimeTypes) {
  const mimeTypes = endpointSchema.consumes || globalMimeTypes || [];
  const isAvailable = m => mimeTypes.includes(m);
  const supportedMimeType = SUPPORTED_MIME_TYPES.find(isAvailable);

  if (supportedMimeType === MIMETYPE_JSON) {
    const isSendInBody = p => p.in === 'body';
    const parameters = endpointSchema.parameters || [];
    const bodyParameter = parameters.find(isSendInBody);
    if (!bodyParameter) {
      return {
        mimeType: supportedMimeType
      }
    }

    const example = (bodyParameter) ? generateParameterExample(bodyParameter.schema) : undefined;
    const text = JSON.stringify(example, null, 2);
    return {
      mimeType: supportedMimeType,
      text
    }
  }

  if (mimeTypes && mimeTypes.length) {
    return {
      mimeType: mimeTypes[0] || undefined
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
function convertParameters (parameters) {
  return parameters.map(parameter => {
    const {required, name} = parameter;
    return {
      name,
      disabled: required !== true,
      value: `${generateParameterExample(parameter)}`
    }
  })
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
function generateParameterExample (schema) {
  const typeExamples = {
    'string': () => 'string',
    'string_email': () => 'user@example.com',
    'string_date-time': () => new Date().toISOString(),
    'string_byte': () => 'ZXhhbXBsZQ==',
    'number': () => 0,
    'number_float': () => 0.0,
    'number_double': () => 0.0,
    'integer': () => 0,
    'boolean': () => true,
    'object': schema => {
      const example = {};
      const {properties} = schema;

      Object.keys(properties).forEach(propertyName => {
        example[propertyName] = generateParameterExample(properties[propertyName]);
      });

      return example;
    },
    'array': schema => {
      const value = generateParameterExample(schema.items);
      if (schema.collectionFormat === 'csv') {
        return value;
      } else {
        return [value];
      }
    }
  };

  if (typeof schema === 'string') {
    return typeExamples[schema];
  }

  if (schema instanceof Object) {
    const {type, format, example, default: defaultValue} = schema;

    if (example) {
      return example;
    }

    if (defaultValue) {
      return defaultValue;
    }

    const factory = typeExamples[`${type}_${format}`] || typeExamples[type];
    return factory(schema);
  }
}
