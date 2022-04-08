/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */

const config = {
    "appId": "com.insomnia.app",
    electronVersion: '17.3.0',
    "protocols": [
        {
            "name": "Insomnia",
            "role": "Viewer",
            "schemes": [
                "insomnia"
            ]
        }
    ],
    directories: {
        output: 'dist',
        buildResources: 'buildResources',
    },
    files: [
        // {
        //     "from": "./packages/insomnia-main/bundle-prod",
        //     "to": "./build",
        //     "filter": ["**/*"]
        // },
        './packages/insomnia-main/bundle-prod/**',
        './packages/insomnia-app/build/**',
    ],
    "linux": {
        "artifactName": "Insomnia.Core-${version}.${ext}",
        "executableName": "insomnia",
        "synopsis": "The Collaborative API Client and Design Tool",
        "category": "Development",
        "target": [
            "AppImage",
            "deb",
            "tar.gz",
            "rpm",
            "snap"
        ]
    }
};

module.exports = config;
