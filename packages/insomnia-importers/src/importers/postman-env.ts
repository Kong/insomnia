import { Converter } from '../entities';

export const id = 'postman-environment';
export const name = 'Postman Environment';
export const description = 'Importer for Postman environments';

interface EnvVar {
  enabled: boolean;
  key: string;
  value: string;
}

interface Environment {
  name: string;
  values: EnvVar[];
  _postman_variable_scope: 'environment' | string;
}

type Data = {
  [key in EnvVar['key']]: EnvVar['value'];
};

export const convert: Converter<Data> = (rawData) => {
  try {
    const { _postman_variable_scope, name, values } = JSON.parse(
      rawData,
    ) as Environment;

    if (_postman_variable_scope !== 'environment') {
      return null;
    }

    return [
      {
        _id: '__ENV_1__',
        _type: 'environment',
        name: name || 'Postman Environment',
        data: values.reduce((accumulator, { enabled, key, value }) => {
          if (!enabled) {
            return accumulator;
          }
          return {
            ...accumulator,
            [key]: value,
          };
        }, {}),
      },
    ];
  } catch (e) {
    // Nothing
  }

  return null;
};
