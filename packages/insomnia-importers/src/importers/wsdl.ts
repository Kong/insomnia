import {
  findWSDLForServiceName,
  getJsonForWSDL,
  getSwaggerForService,
  getWSDLServices,
  Swagger,
} from 'apiconnect-wsdl';

import { Converter } from '../entities';
import * as postman from './postman';

export const id = 'wsdl';
export const name = 'WSDL';
export const description = 'Importer for WSDL files';

const convertToPostman = (items: Swagger[]) => {
  const item = items.map(swagger => {
    const item = [];
    const url = swagger['x-ibm-configuration'].assembly.execute[0].proxy['target-url'];

    for (const path of Object.keys(swagger.paths)) {
      const methods = swagger.paths[path];

      for (const method of Object.keys(methods)) {
        const api = methods[method];
        const paths = api.parameters[0].schema.$ref.split('/');
        paths.shift();
        paths.push('example');
        const example = swagger.paths.join('.');
        item.push({
          name: api.operationId,
          description: api.description || '',
          request: {
            url,
            method,
            header: [
              {
                key: 'SOAPAction',
                value: api['x-ibm-soap.soap-action'],
                disabled: false,
              },
              {
                key: 'Content-Type',
                value: swagger.consumes[0],
                disabled: false,
              },
              {
                key: 'Accept',
                value: swagger.produces[0],
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
      name: swagger.info.title,
      item,
    };
  });
  return {
    info: {
      name: items[0].info.title,
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

export const convert: Converter = async rawData => {
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
