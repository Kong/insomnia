const BINARY_PREFIX = 'Insomnia.Core';

// NOTE: USE_HARD_LINKS
// https://github.com/electron-userland/electron-builder/issues/4594#issuecomment-574653870

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.insomnia.app',
  protocols: [
    {
      name: 'Insomnia',
      role: 'Viewer',
      schemes: ['insomnia'],
    },
  ],
  files: [
    {
      from: './build',
      to: '.',
      filter: ['**/*', '!opensource-licenses.txt'],
    },
    './package.json',
  ],
  publish: null,
  afterSign: './scripts/afterSignHook.js',
  extraResources: [
    {
      from: './bin',
      to: './bin',
      filter: 'yarn-standalone.js',
    },
    {
      from: './build',
      to: '.',
      filter: 'opensource-licenses.txt',
    },
  ],
  extraMetadata: {
    main: 'main.min.js', // Override the main path in package.json
  },
  fileAssociations: [],
  buildDependenciesFromSource: true,
  linux: {
    artifactName: `${BINARY_PREFIX}-\${version}-fedora.\${ext}`,
    executableName: 'insomnia',
    synopsis: 'The Collaborative API Client and Design Tool',
    category: 'Development',
    target: [
      {
        target: 'rpm',
      }
    ],
  },
};

const { env: { BUILD_TARGETS }, platform } = process;
const targets = BUILD_TARGETS?.split(',');
if (platform && targets) {
  console.log('overriding build targets to: ', targets);
  const PLATFORM_MAP = { darwin: 'mac', linux: 'linux', win32: 'win' };
  config[PLATFORM_MAP[platform]].target = config[PLATFORM_MAP[platform]].target.filter(({ target }) => targets.includes(target));
}
module.exports = config;
