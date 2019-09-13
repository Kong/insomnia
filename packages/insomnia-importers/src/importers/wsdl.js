'use strict';
const convert = require('xml-js');

module.exports.id = 'wsdl';
module.exports.name = 'WSDL';
module.exports.description = 'Importer for WSDL files';

let requestCount = 1;

module.exports.convert = function(rawData) {
  requestCount = 1;

  try {
    let jsonString = convert.xml2json(rawData, { compact: true, spaces: 4 });
    let data = JSON.parse(jsonString);
    if (data['wsdl:definitions']) {
      let converted = parseWsdl(data);
      return converted;
    }
  } catch (e) {
    // Nothing
  }

  return null;
};

function parseWsdl(data) {
  let exportObj = {
    _type: 'export',
    __export_format: 4,
    __export_date: '2018-01-09T23:32:46.908Z',
    __export_source: 'insomnia.importers:v0.1.0',
  };
  let port = data['wsdl:definitions']['wsdl:service']['wsdl:port'];
  port = port.length > 0 ? port[0] : port;
  port = port['soap:address']._attributes.location;

  let group = {
    parentId: '__WORKSPACE_ID__',
    _id: '__GROUP_1__',
    _type: 'request_group',
    environment: {
      base_url: port,
    },
    name: data['wsdl:definitions']['wsdl:service']._attributes.name,
  };

  return [group, ...importItems(data, group._id)];
}

function importItems(data, folderId) {
  let operations = data['wsdl:definitions']['wsdl:portType']['wsdl:operation'];
  operations = operations.length > 0 ? operations : [operations];
  return operations.map(op => {
    let requestName = op._attributes.name;
    let requestBody = generateSampleBody(requestName, data);

    return {
      parentId: folderId,
      name: requestName,
      url: '{{ base_url }}',
      body: {
        mimeType: 'application/xml',
        text: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/"><soapenv:Header/><soapenv:Body>${requestBody}</soapenv:Body></soapenv:Envelope>`,
      },
      headers: [
        {
          // insomnia supports only application/xml as a mimeType, but lets default to text/xml
          name: 'Content-Type',
          value: 'text/xml',
        },
      ],
      method: 'POST',
      _type: 'request',
      _id: `__REQUEST_${requestCount++}__`,
    };
  });
}

function generateSampleBody(operationName, data) {
  return `<tem:${operationName}></tem:${operationName}>`;
}
