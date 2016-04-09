var path = require('path');
var webpack = require('webpack');
var base = require('./base.config');
var webpackTargetElectronRenderer = require('webpack-target-electron-renderer');

base.entry = [
  'webpack-hot-middleware/client?path=http://localhost:3333/__webpack_hmr',
  'webpack/hot/only-dev-server'
].concat(base.entry);

base.debug = true;
base.devtool = 'inline-source-map';
base.output.path = path.join(base.output.path, '/dev');
base.output.publicPath = 'http://localhost:3333/dist/';

for (var i = 0; i < base.module.loaders.length; i++) {
  var loader = base.module.loaders[i];
  if (loader.id === 'babel') {
    loader.loaders = ['react-hot'].concat(loader.loaders);
    break;
  }
}

base.plugins = [
  new webpack.HotModuleReplacementPlugin(),
  new webpack.NoErrorsPlugin(),
  new webpack.DefinePlugin({
    __DEV__: true,
    'process.env': {
      NODE_ENV: JSON.stringify('development')
    }
  }),
  new webpack.ExternalsPlugin('commonjs', [
    'request'
  ])
];

base.target = webpackTargetElectronRenderer(base);

module.exports = base;

