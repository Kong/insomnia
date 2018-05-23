const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.babel');

module.exports = {
  ...baseConfig,
  devtool: false,
  mode: 'production',
  optimization: {
    // Minimization causes lots of small problems in a large project like this so
    // we'll just disable it.
    minimize: false
  },
  plugins: [
    ...baseConfig.plugins,
    new webpack.DefinePlugin({
      __DEV__: false,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.HOT': JSON.stringify(null)
    })
  ]
};
