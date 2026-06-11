import { DOMParser } from '@xmldom/xmldom';
// Since there are restrictions that let it not generate full sample request, it's hard-coded in apiconnect-wsdl, so we use patch-package to patch the files in apiconnect-wsdl to remove the restrictions
// The version of apiconnect-wsdl is locked to 2.0.36. If you need to use a newer version in the future, make sure to update the patch file; otherwise, the program may break.
// https://www.npmjs.com/package/patch-package
import {
  findWSDLForServiceName,
  getJsonForWSDL,
  getSwaggerForService,
  getWSDLServices,
  type Swagger,
} from 'apiconnect-wsdl';

import type { FilePathConverter } from '../entities';
import * as postman from './postman';

export const id = 'wsdl';
export const name = 'WSDL';
export const description = 'Importer for WSDL files';
export const acceptFilePath = true;

const pathToSwagger = (swagger: any, path: string[]) => {
  return path.reduce((acc, v: string) => {
    try {
      acc = acc[v];
    } catch {
      return;
    }
    return acc;
  }, swagger);
};

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
        const example = pathToSwagger(swagger, paths);
        item.push({
          name: api.operationId,
          description: api.description || '',
          request: {
            url,
            method,
            header: [
              {
                key: 'SOAPAction',
                value: api['x-ibm-soap']['soap-action'],
              },
              {
                key: 'Content-Type',
                value: swagger.consumes[0],
              },
              {
                key: 'Accept',
                value: swagger.produces[0],
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

// input can be a file path or a file content string
const convertWsdlToPostman = async (input: string) => {
  const wsdls = await getJsonForWSDL(input);
  const { services } = getWSDLServices(wsdls);

  const items = services.map(({ service, filename }: { service: string; filename: string }) => {
    const wsdlEntry = findWSDLForServiceName(wsdls, service);
    return getSwaggerForService(wsdlEntry, service, filename);
  });

  return convertToPostman(items);
};

export const convert: FilePathConverter = async importEntry => {
  const rawData = importEntry.contentStr;

  try {
    if (!verifyWsdl(rawData)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    // here we prioritize using the original file path because the apiconnect-wsdl library can recognize 'import', 'include' tags in a wsdl file and find the referenced xsd files automatically.
    const input = importEntry.oriFilePath
      ? importEntry.oriFilePath
      : `<?xml version="1.0" encoding="UTF-8" ?>${rawData}`;
    const postmanData = await convertWsdlToPostman(input);
    postmanData.info.schema += 'collection.json';
    const postmanJson = JSON.stringify(postmanData);
    return postman.convert(postmanJson);
  } catch (error) {
    console.error(error);
    return {
      convertErrorMessage: error.message,
    };
  }
};

const wsdlNamespaceUri = 'http://schemas.xmlsoap.org/wsdl/';

function verifyWsdl(fileContent: string) {
  try {
    const mainWsdlDocument = new DOMParser().parseFromString(fileContent, 'text/xml');
    return (
      mainWsdlDocument.documentElement?.namespaceURI === wsdlNamespaceUri &&
      mainWsdlDocument.documentElement.localName === 'definitions'
    );
  } catch {
    return false;
  }
}
