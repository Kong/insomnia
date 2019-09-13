'use strict';
var convert = require('xml-js');

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
  let group = {
    parentId: '__WORKSPACE_ID__',
    _id: '__GROUP_1__',
    _type: 'request_group',
    environment: {
      base_url:
        data['wsdl:definitions']['wsdl:service']['wsdl:port'][0]['soap:address']._attributes
          .location,
    },
    name: data['wsdl:definitions']['wsdl:service']._attributes.name,
    description: '',
  };

  exportObj.resources = [group, ...importItems(data, group._id)];
  return exportObj;
}
function importItems(data, folderId) {
  let operations = data['wsdl:definitions']['wsdl:portType']['wsdl:operation'];
  let requests = operations.map(op => {
    let requestName = op._attributes.name;

    return { name: requestName };
  });

  return requests.map(rq => {
    return {
      parentId: folderId,
      name: rq.name,
      url: '{{ base_url }}',
      body: {
        mimeType: 'application/xml', // insomnia supports only application/xml so to be compatible we set a header with text/xml
        text:
          '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">\r\n   <soapenv:Header/>\r\n   <soapenv:Body>\r\n      <tem:Add>\r\n         <tem:intA>5</tem:intA>\r\n         <tem:intB>10</tem:intB>\r\n      </tem:Add>\r\n   </soapenv:Body>\r\n</soapenv:Envelope>',
      },
      headers: [
        {
          name: 'Content-Type',
          value: 'text/xml',
        },
      ],
      method: 'POST',
      parameters: [],
      authentication: {},
      _type: 'request',
      _id: `__REQUEST_${requestCount++}__`,
    };
  });
}
