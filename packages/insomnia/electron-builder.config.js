const BINARY_PREFIX = 'Restless';
// NOTE: USE_HARD_LINKS
// https://github.com/electron-userland/electron-builder/issues/4594#issuecomment-574653870

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration
 */
const config = {
  npmRebuild: false,
  appId: 'com.restless.app',
  protocols: [
    {
      name: 'Restless',
      role: 'Viewer',
      schemes: ['restless'],
    },
  ],
  files: [
    {
      from: './build',
      to: '.',
      filter: ['**/*', '!**/*.map'],
    },
    './package.json',
  ],
  publish: { provider: 'github', owner: 'outmanos', repo: 'restless' },
  extraResources: [
    {
      from: './bin',
      to: './bin',
      filter: 'yarn-standalone.js',
    },
  ],
  extraMetadata: {
    main: 'entry.main.min.js', // Override the main path in package.json
  },
  fileAssociations: [],
  mac: {
    category: 'public.app-category.developer-tools',
    artifactName: `${BINARY_PREFIX}-\${version}.\${ext}`,
    x64ArchFiles: '*',
    target: [
      {
        target: 'dmg',
        arch: 'universal',
      },
      {
        target: 'zip',
        arch: 'universal',
      },
    ],
    mergeASARs: false,
    extendInfo: {
      NSRequiresAquaSystemAppearance: false,
      NSLocalNetworkUsageDescription:
        'Restless needs permission to connect to local APIs and development servers such as localhost, 127.0.0.1, or other LAN hosts.',
      // Allow Finder "Open With → Restless" on folders so they can be opened as Git projects.
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Folder',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: ['public.folder'],
        },
      ],
    },
    notarize: false,
    asarUnpack: [
      'node_modules/node-libcurl',
      'node_modules/@node-llama-cpp/mac-arm64-metal',
      'node_modules/@node-llama-cpp/mac-x64',
      'node_modules/@node-llama-cpp/linux-arm64',
      'node_modules/@node-llama-cpp/linux-armv7l',
      'node_modules/@node-llama-cpp/linux-x64',
      'node_modules/@node-llama-cpp/linux-x64-cuda',
      'node_modules/@node-llama-cpp/linux-x64-cuda-ext',
      'node_modules/@node-llama-cpp/linux-x64-vulkan',
      'node_modules/@node-llama-cpp/win-arm64',
      'node_modules/@node-llama-cpp/win-x64',
      'node_modules/@node-llama-cpp/win-x64-cuda',
      'node_modules/@node-llama-cpp/win-x64-cuda-ext',
      'node_modules/@node-llama-cpp/win-x64-vulkan',
      'node_modules/@reflink/reflink-darwin-arm64',
      'node_modules/@reflink/reflink-darwin-x64',
      'node_modules/@reflink/reflink-linux-arm64-gnu',
      'node_modules/@reflink/reflink-linux-arm64-musl',
      'node_modules/@reflink/reflink-linux-x64-gnu',
      'node_modules/@reflink/reflink-linux-x64-musl',
      'node_modules/@reflink/reflink-win32-arm64-msvc',
      'node_modules/@reflink/reflink-win32-x64-msvc',
    ],
  },
  dmg: {
    window: {
      width: 540,
      height: 380,
    },
    contents: [
      {
        x: 130,
        y: 186,
      },
      {
        x: 409,
        y: 186,
        type: 'link',
        path: '/Applications',
      },
    ],
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    publish: { provider: 'github', owner: 'outmanos', repo: 'restless' },
    generateUpdatesFilesForAllChannels: true,
  },
  nsis: {
    artifactName: `${BINARY_PREFIX}-nsis-\${version}.\${ext}`,
    include: './scripts/nsisInstall.nsh',
    oneClick: false,
    selectPerMachineByDefault: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: './build/icon.ico',
    installerSidebar: './src/icons/nsis-sidebar.bmp',
    uninstallerSidebar: './src/icons/nsis-sidebar.bmp',
    uninstallerIcon: './build/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Restless',
    deleteAppDataOnUninstall: false,
  },
  portable: {
    artifactName: `${BINARY_PREFIX}-\${version}-portable.\${ext}`,
  },
  linux: {
    // artifactName: `${BINARY_PREFIX}-\${version}-\${arch}.\${ext}`, // TODO-ARM64 - Re-enable when we have ARM64 build from insomnia-ee
    artifactName: `${BINARY_PREFIX}-\${version}.\${ext}`,
    executableName: 'restless',
    synopsis: 'The local-first API client',
    category: 'Development',
    desktop: {
      entry: {
        Name: 'Restless',
        Comment: 'The local-first API client',
        Categories: 'Development',
        Keywords: 'GraphQL;REST;gRPC;SOAP;openAPI;GitOps;',
      },
    },
    target: [
      {
        target: 'AppImage',
      },
      {
        target: 'deb',
      },
      {
        target: 'tar.gz',
      },
      {
        target: 'rpm',
      },
      {
        target: 'snap',
      },
    ],
  },
  rpm: {
    // Prevents RPM from packaging build-id metadata, some of which is the
    // same across all electron-builder applications, which causes package
    // conflicts
    fpm: ['--rpm-rpmbuild-define=_build_id_links none'],
  },
  snap: {
    base: 'core22',
  },
};

const {
  env: { BUILD_TARGETS },
  platform,
} = process;
const targets = BUILD_TARGETS?.split(',');
if (platform && targets) {
  console.log('overriding build targets to: ', targets);
  const PLATFORM_MAP = { darwin: 'mac', linux: 'linux', win32: 'win' };
  config[PLATFORM_MAP[platform]].target = config[PLATFORM_MAP[platform]].target.filter(({ target }) =>
    targets.includes(target),
  );
}
module.exports = config;
