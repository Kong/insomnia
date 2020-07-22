"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.gitDataDirDb = exports.emptyDb = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _yaml = _interopRequireDefault(require("yaml"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const emptyDb = () => ({
  ApiSpec: new Map(),
  Environment: new Map(),
  Request: new Map(),
  RequestGroup: new Map(),
  Workspace: new Map()
});

exports.emptyDb = emptyDb;

const gitDataDirDb = async ({
  dir,
  filterTypes
}) => {
  const db = emptyDb();

  const insomniaDir = _path.default.normalize(_path.default.join(dir || '.', '.insomnia'));

  if (!_fs.default.existsSync(insomniaDir)) {
    // TODO: control logging with verbose flag
    // console.log(`Directory not found: ${insomniaDir}`);
    return db;
  }

  const readAndInsertDoc = async (type, fileName) => {
    // Get contents of each file in type dir and insert into data
    const contents = await _fs.default.promises.readFile(fileName);

    const obj = _yaml.default.parse(contents.toString());

    db[type].set(obj._id, obj);
  };

  const types = (filterTypes === null || filterTypes === void 0 ? void 0 : filterTypes.length) ? filterTypes : Object.keys(db);
  await Promise.all(types.map(async type => {
    // Get all files in type dir
    const typeDir = _path.default.join(insomniaDir, type);

    if (!_fs.default.existsSync(typeDir)) {
      return;
    }

    const files = await _fs.default.promises.readdir(typeDir);
    return Promise.all( // Insert each file from each type
    files.map(file => readAndInsertDoc(type, _path.default.join(insomniaDir, type, file))));
  }));
  return db;
};

exports.gitDataDirDb = gitDataDirDb;