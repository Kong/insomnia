const BINARY_PREFIX = 'Insomnia.Core';

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
// NOTE: USE_HARD_LINKS
// https://github.com/electron-userland/electron-builder/issues/4594#issuecomment-574653870
const config = {
    appId: "com.insomnia.app",
    electronVersion: "17.3.0",
    protocols: [
        {
            name: "Insomnia",
            role: "Viewer",
            schemes: ["insomnia"],
        },
    ],
    files: [
        {
            from: "./build",
            to: "./app",
            filter: ["**/*"],
        },
        "./package.json",
    ],
    publish: null,
    afterSign: "./scripts/afterSignHook.js",
    extraResources: [
        {
            from: "./bin",
            to: "./bin",
            filter: "yarn-standalone.js",
        },
        {
            from: "./build",
            to: ".",
            filter: "opensource-licenses.txt",
        },
    ],
    fileAssociations: [],
    directories: {
        app: ".",
        output: "dist",
    },
    mac: {
        hardenedRuntime: true,
        category: "public.app-category.developer-tools",
        entitlements: "./build/static/entitlements.mac.inherit.plist",
    artifactName: `${BINARY_PREFIX}-\${version}.\${ext}`,
        target: ["dmg", "zip"],
        extendInfo: {
            NSRequiresAquaSystemAppearance: false,
        },
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
                type: "link",
                path: "/Applications",
            },
        ],
    },
    win: {
        target: ["squirrel", "portable"],
    },
    squirrelWindows: {
    artifactName: `${BINARY_PREFIX}-\${version}.\${ext}`,
        iconUrl:
            "https://github.com/kong/insomnia/blob/develop/packages/insomnia-app/app/icons/icon.ico?raw=true",
    },
    portable: {
    artifactName: `${BINARY_PREFIX}-\${version}-portable.\${ext}`,
    },
    linux: {
    artifactName: `${BINARY_PREFIX}-\${version}.\${ext}`,
        executableName: "insomnia",
        synopsis: "The Collaborative API Client and Design Tool",
        category: "Development",
        target: ["AppImage", "deb", "tar.gz", "rpm", "snap"],
    },
};

module.exports = config;
