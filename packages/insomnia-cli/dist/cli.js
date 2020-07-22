"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.go = go;

var _generate = require("./commands/generate");

var _util = require("./util");

function makeGenerateCommand(exitOverride) {
  // inso generate
  const generate = (0, _util.createCommand)(exitOverride, 'generate').description('Code generation utilities');
  const conversionTypes = Object.keys(_generate.ConversionTypeMap).join(', '); // inso generate config -t kubernetes config.yaml

  generate.command('config <identifier>').description('Generate configuration from an api spec').requiredOption('-t, --type <value>', `the type of configuration to generate, options are [${conversionTypes}]`).option('-o, --output <path>', 'the output path').action((identifier, cmd) => (0, _generate.generateConfig)(identifier, (0, _util.getAllOptions)(cmd)));
  return generate;
}

function go(args, exitOverride) {
  if (!args) {
    args = process.argv;
  } // inso -v


  (0, _util.createCommand)(!!exitOverride).version((0, _util.getVersion)(), '-v, --version').description('A CLI for Insomnia!').option('--workingDir <dir>', 'Working directory').addCommand(makeGenerateCommand(!!exitOverride)).parseAsync(args).catch(err => console.log('An error occurred', err));
}