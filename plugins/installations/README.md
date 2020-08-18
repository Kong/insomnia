## Setup
```sh
# Install `yalc` globally
npm install -g yalc

# Publish a plugin to yalc
cd ../insomnia-plugin-kong-portal
yalc publish

# Install the plugin into this directory
cd ../installations
yalc add insomnia-plugin-kong-portal --pure

# Set the /installations directory path as an additional plugin path in Insomnia Preferences > General
pwd
```

## Usage
```sh
# Make changes to your package, and re-publish
cd ../insomnia-plugin-kong-portal
yalc publish --push

# Reload plugins via Insomnia Preferences > Plugins > Reload Plugins
```
