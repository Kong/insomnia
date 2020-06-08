#!/usr/bin/env node
// @flow

import { program } from 'commander';
import { makeConfigCommand } from './commands/config';
import * as packageJson from '../package.json';

program
  .storeOptionsAsProperties(false)
  .passCommandToAction(false)
  .version(packageJson.version)
  .addCommand(makeConfigCommand())
  .parse(process.argv);
