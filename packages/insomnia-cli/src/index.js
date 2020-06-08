#!/usr/bin/env node
// @flow

import { program } from 'commander';
import { makeGenerateCommand } from './commands/generate';
import * as packageJson from '../package.json';

program
  .storeOptionsAsProperties(false)
  .passCommandToAction(false)
  .version(packageJson.version, '-v, --version')
  .addCommand(makeGenerateCommand())
  .parse(process.argv);
