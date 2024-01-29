import * as Joi from 'joi';
import path from 'path';

import { isDevelopment, isLinux, isMac, isWindows } from '../../../common/constants';
import {
  optionsSchema,
  parseOptions,
  preSpawnSchema,
  spawnSchema,
} from './options';

// set jq path
let JQ_PATH = '';
const macBinPath = 'src/utils/node-jq/bin/macOS/jq-macos-arm64';
const windowsBinPath = 'src/utils/node-jq/bin/macOS/jq-windows-i386.exe';
const linuxBinPath = 'src/utils/node-jq/bin/macOS/jq-linux-i386';
if (isMac()) {
  JQ_PATH = isDevelopment() ? path.resolve('../insomnia/', macBinPath) : path.resolve(process.resourcesPath, macBinPath);
}

if (isWindows()) {
  JQ_PATH = isDevelopment() ? path.resolve('../insomnia/', windowsBinPath) : path.resolve(process.resourcesPath, windowsBinPath);
}

if (isLinux()) {
  JQ_PATH = isDevelopment() ? path.resolve('../insomnia/', linuxBinPath) : path.resolve(process.resourcesPath, linuxBinPath);
}

console.log(`Loading jq path:  ${JQ_PATH}`);

const NODE_JQ_ERROR_TEMPLATE =
  'node-jq: invalid {#label} ' +
  'argument supplied{if(#label == "path" && #type == "json", " (not a .json file)", "")}' +
  '{if(#label == "path" && #type == "path", " (not a valid path)", "")}: ' +
  '"{if(#value != undefined, #value, "undefined")}"';

const messages = {
  'any.invalid': NODE_JQ_ERROR_TEMPLATE,
  'any.required': NODE_JQ_ERROR_TEMPLATE,
  'string.base': NODE_JQ_ERROR_TEMPLATE,
  'string.empty': NODE_JQ_ERROR_TEMPLATE,
};

const validateArguments = (filter, json, options) => {
  const context = { filter, json };
  const validatedOptions = Joi.attempt(options, optionsSchema);
  const validatedPreSpawn = Joi.attempt(
    context,
    preSpawnSchema.tailor(validatedOptions.input),
    { messages, errors: { wrap: { label: '' } } }
  );
  const validatedArgs = parseOptions(
    validatedOptions,
    validatedPreSpawn.filter,
    validatedPreSpawn.json
  );
  const validatedSpawn = Joi.attempt(
    {},
    spawnSchema.tailor(validatedOptions.input),
    { context: { ...validatedPreSpawn, options: validatedOptions } }
  );

  if (validatedOptions.input === 'file') {
    return {
      args: validatedArgs,
      stdin: validatedSpawn.stdin,
    };
  }
  return {
    args: validatedArgs,
    stdin: validatedSpawn.stdin,
  };
};

export const commandFactory = (filter, json, options = {}, jqPath) => {
  const command = jqPath ? path.join(jqPath, './jq') : JQ_PATH;
  const result = validateArguments(filter, json, options);

  return {
    command,
    args: result.args,
    stdin: result.stdin,
  };
};
