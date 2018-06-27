const webpack = require('webpack');
const path = require('path');
const productionConfig = require('./webpack.config.production.babel');
const pkg = require('../package.json');

const PORT = pkg.dev['dev-server-port'];

let devtool;
let plugins;
const output = {
  libraryTarget: 'commonjs2',
  filename: 'main.min.js'
};

if (process.env.NODE_ENV === 'development') {
  output.path = path.join(__dirname, '../app');
  devtool = 'eval-source-map';
  plugins = [
    new webpack.DefinePlugin({
      'process.env.APP_RENDER_URL': JSON.stringify(
        `http://localhost:${PORT}/renderer.html`
      ),
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development')
    })
  ];
} else {
  output.path = path.join(__dirname, '../build');
  devtool = productionConfig.devtool;
  plugins = productionConfig.plugins;
}

module.exports = {
  ...productionConfig,
  devtool: devtool,
  entry: ['./main.development.js'],
  output: output,
  node: {
    __dirname: false // Use node.js __dirname
  },
  target: 'electron-main',
  plugins: plugins
};
