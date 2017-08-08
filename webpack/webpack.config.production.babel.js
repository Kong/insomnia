const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.babel');

module.exports = {
  ...baseConfig,
  devtool: 'source-map',
  plugins: [
    ...baseConfig.plugins,
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.DefinePlugin({
      __DEV__: false,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.HOT': JSON.stringify(null)
    })
  ]
};
