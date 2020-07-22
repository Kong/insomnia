"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createCommand = createCommand;
exports.getVersion = getVersion;
exports.getAllOptions = getAllOptions;

var _commander = _interopRequireDefault(require("commander"));

var packageJson = _interopRequireWildcard(require("../package.json"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function createCommand(exitOverride, cmd) {
  const command = new _commander.default.Command(cmd).storeOptionsAsProperties(false);

  if (exitOverride) {
    return command.exitOverride();
  }

  return command;
}

function getVersion() {
  return packageJson.version;
}

function getAllOptions(cmd) {
  let opts = {};
  let command = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(),
      ...opts
    };
    command = command.parent;
  } while (command);

  return opts;
}