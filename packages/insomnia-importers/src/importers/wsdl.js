'use strict';
const postman = require('./postman');
const apiWSDL = require('apiconnect-wsdl');

module.exports.id = 'wsdl';
module.exports.name = 'WSDL';
module.exports.description = 'Importer for WSDL files';

module.exports.convert = async function(data) {
  try {
    if (data.indexOf('wsdl:definition') !== -1) {
      const postmanData = await convertWsdlToPostman(
        '<?xml version="1.0" encoding="UTF-8" ?>' + data,
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
const { get } = require('lodash');

function convertToPostman(items) {
  const out = {
    info: {
      name: get(items[0], 'info.title'),
      schema: 'https://schema.getpostman.com/json/collection/v2.0.0/', // required
    },
  };

  out.item = items.map(i => {
    const item = [];
    const url = get(i, 'x-ibm-configuration.assembly.execute.0.proxy.target-url');
    for (const k of Object.keys(i.paths)) {
      const methods = i.paths[k];

      for (const method of Object.keys(methods)) {
        const api = methods[method];
        const paths = get(api, 'parameters.0.schema.$ref').split('/');

        paths.shift();
        paths.push('example');

        const example = get(i, paths.join('.'));

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
                value: get(i, 'consumes.0'),
                disabled: false,
              },
              {
                key: 'Accept',
                value: get(i, 'produces.0'),
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
      name: get(i, 'info.title'),
      item,
    };
  });

  return out;
}

async function convertWsdlToPostman(input) {
  const wsdls = await apiWSDL.getJsonForWSDL(input);
  const serviceData = apiWSDL.getWSDLServices(wsdls);

  // Loop through all services
  const items = [];
  for (const item of Object.keys(serviceData.services)) {
    const svcName = serviceData.services[item].service;
    const wsdlId = serviceData.services[item].filename;
    const wsdlEntry = apiWSDL.findWSDLForServiceName(wsdls, svcName);
    const swagger = apiWSDL.getSwaggerForService(wsdlEntry, svcName, wsdlId);

    items.push(swagger);
  }

  return convertToPostman(items);
}
