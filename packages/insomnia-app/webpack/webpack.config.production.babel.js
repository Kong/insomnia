const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.babel');

module.exports = {
  ...baseConfig,
  devtool: false,
  plugins: [
    ...baseConfig.plugins,
    new webpack.DefinePlugin({
      __DEV__: false,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.HOT': JSON.stringify(null)
    })
  ]
};
