# Why?

Use [yalc](https://github.com/whitecolor/yalc) to emulate the production installation of plugins, without having to publish them to NPM. This is useful for development.

### One time setup
```sh
# Install `yalc` globally
npm install -g yalc

# Publish a plugin to yalc
cd plugins/insomnia-plugin-kong-declarative-config
yalc publish

# Install the plugin into this directory
cd local-plugin-installations
npm run add insomnia-plugin-kong-declarative-config
```

After installation, your directory structure should look like this:

![](assets/installed.png)

Now, set the `local-plugin-installations` directory, as an additional plugin path within Insomnia preferences:

![](assets/preferences.png)

### Active development
```sh
# Make changes to your plugin, and re-publish to reinstall the plugin
cd plugins/insomnia-plugin-kong-declarative-config
yalc publish --push

# Reload plugins via Insomnia Preferences > Plugins > Reload Plugins
```

### Remove
```sh
# Remove a single package
npm run remove insomnia-plugin-kong-declarative-config

# Remove all packages
npm run remove:all
```
