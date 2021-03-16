# Kong Declarative Config (Insomnia Plugin)

[![Npm Version](https://img.shields.io/npm/v/insomnia-plugin-kong-declarative-config.svg)](https://www.npmjs.com/package/insomnia-plugin-kong-declarative-config)

This is a plugin for [Insomnia Designer](https://insomnia.rest) to add the ability to generate
Kong Declarative Config.

## Installation

Install the `insomnia-plugin-kong-declarative-config` plugin from Preferences > Plugins.

![](./assets/plugins.png)

## Usage

Once this plugin is installed, open a document with an OpenAPI specification and navigate to the `Design` view.

If installed correctly, a button titled `Generate Config` will appear in the header (you may need to reopen the document).

![](./assets/generateConfig.png)

Click on this button to open a modal, showing all of the config generator plugins installed and their output.
From here, you can copy the config to your clipboard and execute on your platform.

![](./assets/modal.png)

This config will regenerate each time you click on the button, so that changes in your specification are included.
