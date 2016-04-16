import {Validator} from 'jsonschema';

const validator = new Validator();

const environmentsSchema = {
  id: '/Environment',
  type: 'object',
  properties: {
    name: {type: 'string'},
    data: {type: 'object'}
  },
  required: [
    'data',
    'name'
  ],
  additionalProperties: false
};

const requestGroupSchema = {
  id: '/RequestGroup',
  type: 'object',
  properties: {
    _id: {type: 'string', pattern: '^rg_[\\w]{10}$'},
    type: {type: 'string', pattern: '^RequestGroup$'},
    created: {type: 'number', minimum: 1000000000000, maximum: 10000000000000},
    modified: {type: 'number', minimum: 1000000000000, maximum: 10000000000000},
    name: {type: 'string', minLength: 1},
    environment: {ref: '/Environment'}
  },
  required: [
    '_id',
    'type',
    'created',
    'modified',
    'name',
    'environment'
  ],
  additionalProperties: false
};

validator.addSchema(environmentsSchema);

export default function (requestGroup) {
  return validator.validate(requestGroup, requestGroupSchema);
}
