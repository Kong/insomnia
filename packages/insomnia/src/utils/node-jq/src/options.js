import Joi from 'joi';

import { validateJSONPath } from './utils';

function createBooleanSchema(name, value) {
  return Joi.string().when(`${name}`, {
    is: Joi.boolean().required().valid(true),
    then: Joi.string().default(value),
  });
}

const strictBoolean = Joi.boolean().default(false).strict();
const path = Joi.any()
  .custom((value, helpers) => {
    try {
      validateJSONPath(value);
      return value;
    } catch (e) {
      const errorType = e.message.includes('.json') ? 'json' : 'path';
      return helpers.error('any.invalid', { type: errorType });
    }
  }, 'path validation').required().error(errors => {
    errors.forEach(error => {
      if (error.value === undefined) {
        error.local.type = 'path';
      }
    });
    return errors;
  });

export const optionsSchema = Joi.object({
  color: strictBoolean,
  input: Joi.string().default('file').valid('file', 'json', 'string'),
  locations: Joi.array().items(Joi.string()).default([]),
  output: Joi.string().default('pretty').valid('string', 'compact', 'pretty', 'json'),
  raw: strictBoolean,
  slurp: strictBoolean,
  sort: strictBoolean,
});

export const preSpawnSchema = Joi.object({
  filter: Joi.string().allow('', null).required(),
  json: Joi.any().alter({
    file: schema => {
      return schema.when('/json',
        {
          is: Joi.array().required(),
          then: Joi.array().items(path),
          otherwise: path,
        }).label('path');
    },
    json: schema => Joi.alternatives().try(
      Joi.array(),
      Joi.object().allow('', null).required().label('json object')
    ).required(),
    string: schema => Joi.string().required().label('json string'),
  }),
});

export const spawnSchema = Joi.object({
  args: Joi.object({
    color: createBooleanSchema('$options.color', '--color-output'),
    input: Joi.any().alter({
      file: schema => schema.when('$json', {
        is: [Joi.array().items(Joi.string()), Joi.string()],
        then: Joi.array().default(Joi.ref('$json', {
          adjust: value => {
            return [].concat(value);
          },
        })),
      }),
    }),
    locations: Joi.ref('$options.locations'),
    output: Joi.string().when('$options.output', {
      is: Joi.string().required().valid('string', 'compact'),
      then: Joi.string().default('--compact-output'),
    }),
    raw: createBooleanSchema('$options.raw', '-r'),
    slurp: createBooleanSchema('$options.slurp', '--slurp'),
    sort: createBooleanSchema('$options.sort', '--sort-keys'),
  }).default(),
  stdin: Joi.string().default('').alter({
    json: schema => schema.default(Joi.ref('$json', {
      adjust: value => JSON.stringify(value),
    })),
    string: schema => schema.default(Joi.ref('$json')),
  }),
});

export const parseOptions = (options = {}, filter, json) => {
  const context = { filter, json, options };
  const validatedSpawn = Joi.attempt({}, spawnSchema.tailor(options.input), { context });

  if (options.input === 'file') {
    return Object.keys(validatedSpawn.args).filter(key => key !== 'input')
      .reduce((list, key) => list.concat(validatedSpawn.args[key]), [])
      .concat(filter, json);
  }
  return Object.values(validatedSpawn.args).concat(filter);
};

export const optionDefaults = Joi.attempt({}, optionsSchema);
