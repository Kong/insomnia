// @flow

import { program } from 'commander';
import { makeGenerateCommand } from './commands/generate';
import * as packageJson from '../package.json';

export async function go() {
  await program
    .storeOptionsAsProperties(false)
    .passCommandToAction(false)
    .version(packageJson.version, '-v, --version')
    .addCommand(makeGenerateCommand())
    .parseAsync(process.argv);
}
