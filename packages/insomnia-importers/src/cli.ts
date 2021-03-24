import program from 'commander';
import path from 'path';
import { convert } from './convert';
import fs from 'fs';
import { version } from '../package.json';

export const go = async () => {
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Configure the arguments parsing //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  program
    .version(version, '-v, --version')
    .usage('[options] <input>')
    .option('-o, --output <path>', 'output directory')
    .parse(process.argv);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  // Set up the directory to work on //
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
  const inputPath = program.args[0];
  if (!inputPath) {
    console.log('Input path not specified');
    process.exit(1);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~ //
  // Convert the input file //
  // ~~~~~~~~~~~~~~~~~~~~~~ //
  const fullInputPath = path.resolve(inputPath);
  const fileContents = fs.readFileSync(fullInputPath, 'utf8');
  const result = await convert(fileContents);
  const exportContents = JSON.stringify(result.data, null, 2);

  // ~~~~~~~~~~~~~~~~ //
  // Write the output //
  // ~~~~~~~~~~~~~~~~ //
  const outputPath = program.args[1];
  if (outputPath) {
    const fullOutputPath = path.resolve(outputPath);
    fs.writeFileSync(fullOutputPath, exportContents);
  } else {
    console.log(exportContents);
  }
};
