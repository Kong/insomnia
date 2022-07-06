import https from 'https';
import { statSync, mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

/*

This simple (and zero dependency) script's purpose in life is to help the Insomnia team answer questions like "I wonder how many plugins use <XYZ>".
In short, it uses the NPM search API and grabs all plugins and puts them into a temporary npm package, the thought being that you can then open up your editor on that temporary package's `node_modules` directory and be able to search the code of all plugins.

Using NPM in this way is a little less error-prone than, say, if we were to clone each repo from GitHub, because what's on GitHub may not match what's on NPM -> and NPM is what the app uses.

IMPORTANT:
For this script to really work well for finding all plugins, it needs to handle multiple page sizes on the npm search API since there are more plugins on npm than the max page size allows.
However, since the initial use-case for this script is for theme plugins (which there are only 36 of, as of 20220706), multiple pages are not handled.

*/

const npmSearchText = 'insomnia-plugin-theme';

/** the default is 20 and the max is 250 */
const pageSize = 250;

/** https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search */
const npmSearchUrl = `https://registry.npmjs.org/-/v1/search?text=${npmSearchText}&size=${pageSize}`;

const request = https.get(npmSearchUrl, response => {
  let data: Uint8Array[] = [];
  response.on('data', (chunk: Uint8Array) => {
    data.push(chunk);
  });
  response.on('error', console.error);
  response.on('end', () => {
    const unparsed = Buffer.concat(data).toString();
    const { objects } = JSON.parse(unparsed);
    const names: string[] = objects.map(result => result.package.name);
    console.log(names);

    const directory = './scripts/npm-plugins';
    try {
      statSync(directory);
    } catch (error) {
      mkdirSync(directory);
    }

    const packageJson = {
      name: 'npm-plugins',
      dependencies: names.reduce((accumulator, npm) => ({
        ...accumulator,
        [npm]: '*',
      }), {}),
    };
    writeFileSync(`${directory}/package.json`, JSON.stringify(packageJson, null, 2));
    execSync(`npm install --prefix ${directory}`);
  });
});

request.on('error', console.error);

request.end();
