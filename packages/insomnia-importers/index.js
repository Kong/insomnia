const utils = require('./src/utils');

const importers = [
  require('./src/importers/insomnia-1'),
  require('./src/importers/insomnia-2'),
  require('./src/importers/insomnia-3'),
  require('./src/importers/insomnia-4'),
  require('./src/importers/postman'),
  require('./src/importers/postman-env'),
  require('./src/importers/har'),
  require('./src/importers/curl'),
  require('./src/importers/swagger2'),
  require('./src/importers/openapi3'),
  require('./src/importers/wsdl'),
];

module.exports.convert = async function(contents) {
  for (const importer of importers) {
    const resources = await importer.convert(contents);

    if (resources) {
      if (resources.length > 0 && resources[0].variable) {
        resources[0].environment = resources[0].variable;
      }
      const parsedData = {
        type: {
          id: importer.id,
          name: importer.name,
          description: importer.description,
        },
        data: {
          _type: 'export',
          __export_format: 4,
          __export_date: utils.getDateString(),
          __export_source: 'insomnia.importers:v0.1.0',
          resources: resources.map(utils.setDefaults),
        },
      };

      return parsedData;
    }
  }

  throw new Error('No importers found for file');
};
