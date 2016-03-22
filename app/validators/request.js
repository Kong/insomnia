import {Validator} from 'jsonschema';
import {METHODS} from "../constants/global";

const validator = new Validator();
const paramSchema = {
  id: '/Param',
  type: 'object',
  properties: {
    name: {type: 'string'},
    value: {type: 'string'}
  },
  required: ['name'],
  additionalProperties: false
};

const headerSchema = {
  id: '/Header',
  type: 'object',
  properties: {
    name: {type: 'string', minLength: 1},
    value: {type: 'string', minLength: 0}
  },
  required: ['name', 'value'],
  additionalProperties: false
};

const noAuthenticationSchema = {
  id: '/NoAuthentication',
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false
};

const basicAuthenticationSchema = {
  id: '/BasicAuthentication',
  type: 'object',
  properties: {
    username: {type: 'string', minLength: 1},
    password: {type: 'string', minLength: 0}
  },
  required: ['username', 'password'],
  additionalProperties: false
};

const requestSchema = {
  id: '/Request',
  type: 'object',
  properties: {
    _mode: {type: 'string'},
    id: {type: 'string', pattern: '^rq_[\\w]{13}$'},
    created: {type: 'number', minimum: 1000000000000, maximum: 10000000000000},
    modified: {type: 'number', minimum: 1000000000000, maximum: 10000000000000},
    name: {type: 'string', minLength: 1},
    method: {enum: METHODS},
    url: {type: 'string'},
    body: {type: 'string'},
    authentication: {
      oneOf: [
        {$ref: '/BasicAuthentication'},
        {$ref: '/NoAuthentication'}
      ]
    },
    params: {type: 'array', items: {$ref: '/Param'}},
    headers: {type: 'array', items: {$ref: '/Header'}}
  },
  required: [
    '_mode',
    'id',
    'url',
    'created',
    'modified',
    'name',
    'method',
    'body',
    'authentication',
    'params',
    'headers'
  ],
  additionalProperties: false
};

validator.addSchema(paramSchema);
validator.addSchema(headerSchema);
validator.addSchema(noAuthenticationSchema);
validator.addSchema(basicAuthenticationSchema);

export default function (requestObject) {
  const result = validator.validate(requestObject, requestSchema);
  if (result.errors.length) {
    // console.warn(result.errors);
  }

  return result;
}
