// @flow
import { ConversionTypeMap, generateConfig } from './commands/generate-config';
import { getVersion, createCommand, getAllOptions, logErrorExit1, exit } from './util';
import { runInsomniaTests, TestReporterEnum } from './commands/run-tests';
import { lintSpecification } from './commands/lint-specification';
import { parseArgsStringToArgv } from 'string-argv';

function makeGenerateCommand(exitOverride: boolean) {
  // inso generate
  const generate = createCommand(exitOverride, 'generate').description('Code generation utilities');

  const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

  // inso generate config -t kubernetes config.yaml
  generate
    .command('config [identifier]')
    .description('Generate configuration from an api spec.')
    .requiredOption(
      '-t, --type <value>',
      `type of configuration to generate, options are [${conversionTypes}]`,
      'declarative',
    )
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) => exit(generateConfig(identifier, getAllOptions(cmd))));

  return generate;
}

function makeTestCommand(exitOverride: boolean) {
  // inso run
  const run = createCommand(exitOverride, 'run').description('Execution utilities');

  const reporterTypes = Object.keys(TestReporterEnum).join(', ');

  // inso run tests
  run
    .command('test [identifier]')
    .description('Run Insomnia unit test suites')
    .option('-e, --env <identifier>', 'environment to use')
    .option('-t, --test-name-pattern <regex>', 'run tests that match the regex')
    .option(
      '-r, --reporter <reporter>',
      `reporter to use, options are [${reporterTypes}]`,
      TestReporterEnum.spec,
    )
    .option('-b, --bail', 'abort ("bail") after first test failure')
    .option('--keep-file', 'do not delete the generated test file')
    .action((identifier, cmd) => exit(runInsomniaTests(identifier, getAllOptions(cmd))));

  return run;
}

function makeLintCommand(exitOverride: boolean) {
  // inso lint
  const lint = createCommand(exitOverride, 'lint').description('Linting utilities');

  // inso lint spec
  lint
    .command('spec [identifier]')
    .description('Lint an API Specification')
    .action((identifier, cmd) => exit(lintSpecification(identifier, getAllOptions(cmd))));

  return lint;
}

let passThroughArgs = [];

function addScriptCommand(originalCommand: Object) {
  // inso script
  originalCommand
    .command('script <name>', { isDefault: true })
    .description('Run scripts defined in .insorc')
    .action(async (scriptName, cmd) => {
      const options = getAllOptions(cmd);

      // if (!cmd.args.includes('--')) {
      //   passThroughArgs = cmd.args.slice(1);
      // }

      const scriptTask = options?.scripts[scriptName];

      if (!scriptTask) {
        console.log(`Could not find inso script "${scriptName}" in the config file.`);
        await exit(new Promise(resolve => resolve(false)));
        return;
      }

      let argsToRunWith: Array<string> = [...parseArgsStringToArgv(scriptTask), ...passThroughArgs];

      const index = argsToRunWith.indexOf('--');
      if (index !== -1) {
        passThroughArgs = argsToRunWith.slice(index + 1);
        argsToRunWith = argsToRunWith.slice(0, index);
      }

      console.log(argsToRunWith);
      runWithArgs(makeCli(), argsToRunWith, true);
    });
}

function makeCli(exitOverride?: boolean): Object {
  // inso -v
  let cmd = createCommand(!!exitOverride)
    .version(getVersion(), '-v, --version')
    .description('A CLI for Insomnia!');

  cmd = cmd
    .option('-w, --working-dir <dir>', 'set working directory')
    .option('-a, --app-data-dir <dir>', 'set the app data directory')
    .option('--ci', 'run in CI, disables all prompts')
    .addCommand(makeGenerateCommand(!!exitOverride))
    .addCommand(makeTestCommand(!!exitOverride))
    .addCommand(makeLintCommand(!!exitOverride));

  addScriptCommand(cmd);
  return cmd;
}

export function go(args?: Array<string>, exitOverride?: boolean): void {
  if (!args) {
    args = process.argv;
  }

  runWithArgs(makeCli(exitOverride), args);
}

function runWithArgs(cmd: Object, args: Array<string>, user?: boolean) {
  cmd.parseAsync(args, user && { from: 'user' }).catch(logErrorExit1);
}
