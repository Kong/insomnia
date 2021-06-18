import * as postman from './postman';
import {
  getJsonForWSDL,
  getWSDLServices,
  findWSDLForServiceName,
  getSwaggerForService,
  Swagger,
} from 'apiconnect-wsdl';
import { get } from 'lodash';
import { Converter } from '../entities';

export const id = 'wsdl';
export const name = 'WSDL';
export const description = 'Importer for WSDL files';

const convertToPostman = (items: Swagger[]) => {
  const item = items.map((swagger) => {
    const item = [];
    const url = get(
      swagger,
      'x-ibm-configuration.assembly.execute.0.proxy.target-url',
    );

    for (const path of Object.keys(swagger.paths)) {
      const methods = swagger.paths[path];

      for (const method of Object.keys(methods)) {
        const api = methods[method];
        const paths = get(api, 'parameters.0.schema.$ref').split('/');
        paths.shift();
        paths.push('example');
        const example = get(swagger, paths.join('.'));
        item.push({
          name: api.operationId,
          description: api.description || '',
          request: {
            url,
            method,
            header: [
              {
                key: 'SOAPAction',
                value: get(api, 'x-ibm-soap.soap-action'),
                disabled: false,
              },
              {
                key: 'Content-Type',
                value: get(swagger, 'consumes.0'),
                disabled: false,
              },
              {
                key: 'Accept',
                value: get(swagger, 'produces.0'),
                disabled: false,
              },
            ],
            body: {
              mode: 'raw',
              raw: example,
            },
          },
        });
      }
    }

    return {
      name: get(swagger, 'info.title'),
      item,
    };
  });
  return {
    info: {
      name: get(items[0], 'info.title'),
      schema: 'https://schema.getpostman.com/json/collection/v2.0.0/', // required
    },
    item,
  };
};

const convertWsdlToPostman = async (input: string) => {
  const wsdls = await getJsonForWSDL(input);
  const { services } = getWSDLServices(wsdls);

  const items = services.map(({ service, filename }) => {
    const wsdlEntry = findWSDLForServiceName(wsdls, service);
    return getSwaggerForService(wsdlEntry, service, filename);
  });

  return convertToPostman(items);
};

export const convert: Converter = async (rawData) => {
  try {
    if (rawData.indexOf('wsdl:definition') !== -1) {
      const postmanData = await convertWsdlToPostman(
        `<?xml version="1.0" encoding="UTF-8" ?>${rawData}`,
      );
      postmanData.info.schema += 'collection.json';
      const postmanJson = JSON.stringify(postmanData);
      return postman.convert(postmanJson);
    }
  } catch (e) {
    // Nothing
  }

  return null;
};
