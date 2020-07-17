// @flow
import { ConversionTypeMap, generateConfig } from './commands/generate-config';
import {
  getVersion,
  getAllOptions,
  logErrorExit1,
  exit,
  isDevelopment,
  getCosmiConfig,
} from './util';
import { runInsomniaTests, TestReporterEnum } from './commands/run-tests';
import { lintSpecification } from './commands/lint-specification';
import { exportSpecification } from './commands/export-specification';
import { parseArgsStringToArgv } from 'string-argv';
import commander from 'commander';

function createCommand(cmd?: string, options?: Object = {}) {
  return new commander.Command(cmd, options).storeOptionsAsProperties(false);
}

function makeGenerateCommand() {
  // inso generate
  const generate = createCommand('generate').description('Code generation utilities');

  const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

  const defaultType = 'declarative';
  // inso generate config -t kubernetes config.yaml
  generate
    .command('config [identifier]')
    .description('Generate configuration from an api spec.')
    .option(
      '-t, --type <value>',
      `type of configuration to generate, options are [${conversionTypes}] (default: ${defaultType})`,
    )
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) =>
      exit(generateConfig(identifier, getAllOptions(cmd, { type: defaultType }))),
    );

  return generate;
}

function makeTestCommand() {
  // inso run
  const run = createCommand('run').description('Execution utilities');

  const reporterTypes = Object.keys(TestReporterEnum).join(', ');

  const defaultReporter = TestReporterEnum.spec;
  // inso run tests
  run
    .command('test [identifier]')
    .description('Run Insomnia unit test suites')
    .option('-e, --env <identifier>', 'environment to use')
    .option('-t, --testNamePattern <regex>', 'run tests that match the regex')
    .option(
      '-r, --reporter <reporter>',
      `reporter to use, options are [${reporterTypes}] (default: ${defaultReporter})`,
    )
    .option('-b, --bail', 'abort ("bail") after first test failure')
    .option('--keepFile', 'do not delete the generated test file')
    .action((identifier, cmd) =>
      exit(runInsomniaTests(identifier, getAllOptions(cmd, { reporter: defaultReporter }))),
    );

  return run;
}

function makeLintCommand() {
  // inso lint
  const lint = createCommand('lint').description('Linting utilities');

  // inso lint spec
  lint
    .command('spec [identifier]')
    .description('Lint an API Specification')
    .action((identifier, cmd) => exit(lintSpecification(identifier, getAllOptions(cmd))));

  return lint;
}

function makeExportCommand() {
  // inso export
  const exportCmd = createCommand('export').description('Export data from insomnia models');

  // inso export spec
  exportCmd
    .command('spec [identifier]')
    .description('Export an API Specification to a file')
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) => exit(exportSpecification(identifier, getAllOptions(cmd))));

  return exportCmd;
}

function addScriptCommand(originalCommand: Object) {
  // inso script
  originalCommand
    .command('script <name>', { isDefault: true })
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    .action((scriptName, cmd) => {
      // Load scripts
      const cosmiconfig = getCosmiConfig();
      if (!cosmiconfig || cosmiconfig.isEmpty) {
        console.log(`Could not find inso config file in the current directory tree.`);
        return exit(new Promise(resolve => resolve(false)));
      }

      // Ignore the first arg because that will be scriptName, get the rest
      const passThroughArgs = cmd.args.slice(1);

      // Find script
      const scriptTask = cosmiconfig.config.scripts?.[scriptName];

      if (!scriptTask) {
        console.log(`Could not find inso script "${scriptName}" in the config file.`);
        return exit(new Promise(resolve => resolve(false)));
      }

      // Collect args
      const scriptArgs: Array<string> = parseArgsStringToArgv(
        `${scriptTask} ${passThroughArgs.join(' ')}`,
      );

      // Print command
      console.log(`> > inso ${scriptArgs.join(' ')}`);

      // Run
      runWithArgs(originalCommand, scriptArgs, true);
    });
}

function makeDebugCommand(): Object {
  // inso export
  const debug = createCommand('debug').description('Debugging commands');

  // inso export spec
  debug
    .command('options')
    .description('Print all options parsed')
    .allowUnknownOption()
    .action(cmd => {
      const options = getAllOptions(cmd);

      console.log(`getAllOptions resolves to:\n${JSON.stringify(options, null, 2)}`);
      console.log(`cmd.args resolves to:\n${JSON.stringify(cmd.args)}`);

      return exit(
        new Promise<boolean>(resolve => resolve(false)),
      );
    });

  return debug;
}

function makeCli(): Object {
  // inso
  const cmd = createCommand();

  // Version and description
  cmd.version(getVersion(), '-v, --version').description('A CLI for Insomnia!');

  // Global options
  cmd
    .option('-w, --workingDir <dir>', 'set working directory')
    .option('-a, --appDataDir <dir>', 'set the app data directory')
    .option('--ci', 'run in CI, disables all prompts');

  // Add commands and sub commands
  cmd
    .addCommand(makeGenerateCommand())
    .addCommand(makeTestCommand())
    .addCommand(makeLintCommand())
    .addCommand(makeExportCommand());

  // Add script base command
  addScriptCommand(cmd);

  // Debugging commands
  if (isDevelopment()) {
    cmd.addCommand(makeDebugCommand());
  }

  return cmd;
}

export function go(args?: Array<string>): void {
  if (!args) {
    args = process.argv;
  }

  runWithArgs(makeCli(), args);
}

function runWithArgs(cmd: Object, args: Array<string>, user?: boolean) {
  cmd.parseAsync(args, user && { from: 'user' }).catch(logErrorExit1);
}
