import {Validator} from 'jsonschema';

const validator = new Validator();

const environmentsSchema = {
  id: '/RequestGroupEnvironment',
  type: 'object',
  properties: {}
};

const requestGroupSchema = {
  id: '/RequestGroup',
  type: 'object',
  properties: {
    id: {type: 'string', pattern: '^rg_[\\w]{10}$'},
    created: {type: 'number', minimum: 1000000000000, maximum: 10000000000000},
    modified: {type: 'number', minimum: 1000000000000, maximum: 10000000000000},
    name: {type: 'string', minLength: 1},
    environment: {type: 'object'}
  },
  required: [
    '_mode',
    'id',
    'created',
    'modified',
    'name',
    'environment'
  ],
  additionalProperties: false
};

export default function (requestGroup) {
  return validator.validate(requestGroup, requestGroupSchema);
}
