# Why?

Use [yalc](https://github.com/whitecolor/yalc) to emulate the production installation of plugins, without having to publish them to NPM. This is useful for development.

## Setup
### One time
```sh
# Install `yalc` globally
npm install -g yalc

# Publish a plugin to yalc
cd insomnia/plugins/insomnia-plugin-kong-portal
yalc publish

# Install the plugin into this directory
cd insomnia/local-plugin-installations
yalc add insomnia-plugin-kong-portal --pure
```

After the above steps are complete, mark the `insomnia/local-plugin-installations/.yalc` directory, as an additional plugin path within Insomnia preferences.

![](screenshot.png)

### Continuous
```sh
# Make changes to your plugin, and re-publish to reinstall the plugin
cd insomnia/plugins/insomnia-plugin-kong-portal
yalc publish --push

# Reload plugins via Insomnia Preferences > Plugins > Reload Plugins
```
