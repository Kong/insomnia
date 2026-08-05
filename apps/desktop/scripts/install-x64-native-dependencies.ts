import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const packageRoot = path.join(__dirname, '..', '..', '..');

const NLC_NM_PATH = 'node_modules/@node-llama-cpp/mac-x64';
const RL_NM_PATH = 'node_modules/@reflink/reflink-darwin-x64';

const packageLockJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package-lock.json'), 'utf8'));
const nlcVersion = packageLockJson.packages[NLC_NM_PATH].version;
const rlVersion = packageLockJson.packages[RL_NM_PATH].version;

const nlcNpmUrl = `https://registry.npmjs.org/@node-llama-cpp/mac-x64/-/mac-x64-${nlcVersion}.tgz`;
const rlNpmUrl = `https://registry.npmjs.org/@reflink/reflink-darwin-x64/-/reflink-darwin-x64-${rlVersion}.tgz`;

const nlcTgzPath = path.join(packageRoot, 'nlc.tgz');
const rlTgzPath = path.join(packageRoot, 'reflink.tgz');

const nlcExtractedPath = path.join(packageRoot, NLC_NM_PATH);
const rlExtractedPath = path.join(packageRoot, RL_NM_PATH);

execSync(`curl -o ${nlcTgzPath} -L ${nlcNpmUrl}`);
execSync(`curl -o ${rlTgzPath} -L ${rlNpmUrl}`);

execSync(`mkdir -p ${nlcExtractedPath}`);
execSync(`mkdir -p ${rlExtractedPath}`);

execSync(`tar -xzf ${nlcTgzPath} -C ${nlcExtractedPath} --strip-components=1`);
execSync(`tar -xzf ${rlTgzPath} -C ${rlExtractedPath} --strip-components=1`);

fs.unlinkSync(nlcTgzPath);
fs.unlinkSync(rlTgzPath);
