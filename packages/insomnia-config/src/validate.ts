import { betterAjvErrors, BetterAjvErrorsOptions, ValidationError } from '@apideck/better-ajv-errors';
import Ajv, { ErrorObject } from 'ajv';

import { InsomniaConfig } from './entities';
import schema from './generated/schemas/insomnia.schema.json';

const ajv = new Ajv({
  allErrors: true,
  verbose: true,
});

export const ingest = (input: string | InsomniaConfig | unknown) => {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as InsomniaConfig;
    } catch (error: unknown) {
      throw error;
    }
  }
  return input;
};

export interface ValidResult {
  valid: true;
}

export interface ErrorResult {
  valid: false;
  errors: ErrorObject[];
  humanErrors: ValidationError[];
}

export type ValidationResult = ValidResult | ErrorResult;

export const isValidResult = (result: ValidationResult): result is ValidResult => result.valid === true;
export const isErrorResult = (result: ValidationResult): result is ErrorResult => result.valid === false;

export const validate = (input: string | InsomniaConfig | unknown): ValidationResult => {
  const data = ingest(input);
  const validator = ajv.compile<InsomniaConfig>(schema);
  const valid = validator(data);

  if (valid) {
    const validResult: ValidResult = {
      valid: true,
    };
    return validResult;
  }

  const { errors } = validator;

  if (!errors) {
    throw new Error('unable to validate json schema');
  }

  const errorResult: ErrorResult = {
    valid: false,
    errors,
    humanErrors: betterAjvErrors({
      basePath: '',
      data,
      errors,
      schema: (schema as BetterAjvErrorsOptions['schema']),
    }),
  };
  return errorResult;
};
