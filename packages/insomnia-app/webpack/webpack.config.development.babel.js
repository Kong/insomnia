const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.babel');
const pkg = require('../package.json');

const PORT = pkg.dev['dev-server-port'];

const d = new Date();
const date = d.toLocaleDateString();

module.exports = {
  ...baseConfig,
  devtool: 'eval-source-map',
  mode: 'development',
  entry: [
    `webpack-dev-server/client?http://localhost:${PORT}`,
    'webpack/hot/only-dev-server',
    ...baseConfig.entry,
  ],
  output: {
    ...baseConfig.output,
    publicPath: '/',
  },
  devServer: {
    host: 'localhost',
    port: PORT,
    publicPath: '/',
    hot: true,
    disableHostCheck: true,
  },
  plugins: [
    ...baseConfig.plugins,
    new webpack.LoaderOptionsPlugin({ debug: true }), // Legacy global loader option
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.DefinePlugin({
      __DEV__: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development'),
    }),
  ],
};
