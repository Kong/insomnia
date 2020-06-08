#!/usr/bin/env node
// @flow

import { program } from 'commander';
import generateConfig from './commands/generate-config';

// Print coffee drinks menu
// $ coffee-shop list
// $ coffee-shop ls
program
  .command('generate-config')
  .alias('gc')
  .description('Generate configuration')
  .action(generateConfig);

// allow commander to parse `process.argv`
program.parse(process.argv);
