const SwaggerParser = require('swagger-parser');

const SUPPORTED_VERSION = '2.0';

const MIMETYPE_JSON = 'application/json';
const SUPPORTED_MIME_TYPES = [MIMETYPE_JSON];

module.exports.id = 'swagger2';
module.exports.name = 'Swagger 2.0';
module.exports.description = 'Importer for Swagger 2.0 specification (json/yaml)';

module.exports.convert = async function (rawData) {
  const parser = new SwaggerParser();
  let data;

  try {
    data = JSON.parse(rawData);
    if(!data) {
      data = SwaggerParser.YAML.parse(rawData);
    }

    if(!data) {
      return null;
    }
  } catch (err) {
    return null;
  }
  //TODO: check if above could be written simpler

  try {
    data = await parser.validate(data);
  } catch (err) {
    return null;
  }

  if(!data.swagger || data.swagger !== SUPPORTED_VERSION) {
    return null;
  }

  const workspace = {
    "_type": "workspace",
    "_id": "__WORKSPACE_1__",
    "parentId": null,
    "created": Date.now(),
    "modified":  Date.now(),
    "name": `${data.info.title} ${data.info.version}`,
    "description": data.info.description
  };

  const baseEnv = {
    "_type": "environment",
    "_id": "__ENV_1__",
    "parentId": "__WORKSPACE_1__",
    "name": "Base environment",
    "data": {
      base_url: '{{ scheme }}://{{ host }}{{ base_path }}'
    }
  };

  const swaggerEnv = {
    "_type": "environment",
    "_id": "__ENV_2__",
    "parentId": baseEnv._id,
    "name": "Swagger env",
    "data": {
      base_path: data.basePath,
      scheme: data.schemes[0],
      host: data.host
    }
  }



  const globalMimeTypes = data.consumes;

  const paths = Object.keys(data.paths);
  const endpointsData = paths.map(path => {
    const methodsMap = data.paths[path];
    const methods = Object.keys(methodsMap);

    return methods.map(method => {
      return {
        ...methodsMap[method],
        path,
        method
      }
    })
  }).reduce((flat, arr) => flat.concat(arr), []);


  const defaultParent = workspace._id;
  const endpoints = endpointsData.map((endpointSchema, index) => {
    let { path, method, operationId: _id, summary  } = endpointSchema;

    const name = summary || `${method} ${path}`;
    const url = "{{ base_url }}" + path;

    path = path.replace(/{(.+)}/, "{{ $1 }}");

    return {
      _type: "request",
      _id: data.operationId || `__REQUEST_${index}__`,
      parentId: defaultParent,
      name,
      method: method.toUpperCase(),
      url: "{{ base_url }}" + path,
      body: prepareBody(),
      headers: prepareHeaders(),
      parameters: prepareQueryParams()
    }


    function prepareQueryParams() {
      const isSendInQuery = p => p.in == "query";
      const queryParameters = endpointSchema.parameters.filter(isSendInQuery);

      return queryParameters.map(parameter => {
        const { required, name } = parameter;
        return {
          name,
          disabled: required !== true,
          value: schemaMock(parameter)
        }
      })
    }

    function prepareHeaders() {
      const isSendInHeader = p => p.in == "header";
      const headerParameters = endpointSchema.parameters.filter(isSendInHeader);

      return headerParameters.map(parameter => {
        const { required, name } = parameter;
        return {
          name,
          disabled: required !== true,
          value: schemaMock(parameter)
        }
      })
    }

    function prepareBody() {
      const implementedMimeTypes = endpointSchema.consumes || globalMimeTypes || [];
      const isImplemented = m => implementedMimeTypes.includes(m);
      const mimeType = SUPPORTED_MIME_TYPES.find(isImplemented);

      if(mimeType === MIMETYPE_JSON) {
        const isSendInBody = p => p.in == "body";
        const bodyParameter = endpointSchema.parameters.find(isSendInBody);
        const bodyMock = (bodyParameter) ? schemaMock(bodyParameter.schema) : undefined;
        const text = JSON.stringify(bodyMock, null, 2);

        return {
          mimeType,
          text
        }
      }

      return {};
    }
  });

  return [
    workspace,
    baseEnv,
    swaggerEnv,
    ...endpoints
  ];
};


function schemaMock(schema) {
  const typeExamples = {
    "string": () => "string",
    "string_email": () => "user@example.com",
    "string_date-time": () => new Date().toISOString(),
    "string_byte": () => "ZXhhbXBsZQ==",
    "number": () => 0,
    "number_float": () => 0.0,
    "number_double": () => 0.0,
    "integer": () => 0,
    "boolean": () => true,
    "object": (schema) => {
      const mock = {};
      const { properties } = schema;
      Object.keys(properties).forEach((propertyName) => {
        const schema = properties[propertyName];
        mock[propertyName] = schemaMock(schema);
      }, this);

      return mock;
    },
    "array": (schema) => {
      return [ schemaMock(schema.items) ]
    }
  }

  if(typeof schema === "string") {
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
    return factory(schema);
  }
}
