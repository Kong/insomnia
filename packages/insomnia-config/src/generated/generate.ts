import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { CompilerOptions, generateSchema, getProgramFromFiles, PartialArgs } from 'typescript-json-schema';

const settings: PartialArgs = {
  // TODO (INS-1033): some day, it'd be ideal to do something like this. (when we do, remember to change the README for insomnia-config)
  // id: 'https://schema.insomnia.rest/json/draft-07/config/v1.0.0/',
  noExtraProps: true,
  required: true,
};

const compilerOptions: CompilerOptions = {
  strict: true,
};

const basePath = '.';

const program = getProgramFromFiles(
  [resolve('./src/entities.ts')],
  compilerOptions,
  basePath,
);

export const schema = generateSchema(
  program,
  'InsomniaConfig',
  settings,
);

if (schema === null) {
  throw new Error('failed to generate Insomnia Config');
}

const schemaDestination = './src/generated/schemas/insomnia.schema.json';
const stringSchema = JSON.stringify(schema, null, 2);
writeFileSync(schemaDestination, stringSchema);
