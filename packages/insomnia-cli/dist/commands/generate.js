"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.generateConfig = generateConfig;
exports.ConversionTypeMap = void 0;

var o2k = _interopRequireWildcard(require("openapi-2-kong"));

var _yaml = _interopRequireDefault(require("yaml"));

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _memDb = require("../db/mem-db");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const ConversionTypeMap = {
  kubernetes: 'kong-for-kubernetes',
  declarative: 'kong-declarative-config'
};
exports.ConversionTypeMap = ConversionTypeMap;

function validateOptions({
  type
}) {
  if (!ConversionTypeMap[type]) {
    const conversionTypes = Object.keys(ConversionTypeMap).join(', ');
    console.log(`Config type "${type}" not unrecognized. Options are [${conversionTypes}].`);
    return false;
  }

  return true;
}

async function generateConfig(identifier, options) {
  if (!validateOptions(options)) {
    return;
  }

  const {
    type,
    output,
    workingDir
  } = options;
  const db = await (0, _memDb.gitDataDirDb)({
    dir: workingDir,
    filterTypes: ['ApiSpec']
  });
  let result;
  const specFromDb = db.ApiSpec.get(identifier);

  try {
    if (specFromDb === null || specFromDb === void 0 ? void 0 : specFromDb.contents) {
      result = await o2k.generateFromString(specFromDb.contents, ConversionTypeMap[type]);
    } else {
      result = await o2k.generate(identifier, ConversionTypeMap[type]);
    }
  } catch (err) {
    console.log('Config failed to generate', err);
    return;
  }

  const yamlDocs = result.documents.map(d => _yaml.default.stringify(d)); // Join the YAML docs with "---" and strip any extra newlines surrounding them

  const document = yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n');

  if (output) {
    const fullOutputPath = _path.default.resolve(output);

    _fs.default.writeFileSync(fullOutputPath, document);
  } else {
    console.log(document);
  }
}