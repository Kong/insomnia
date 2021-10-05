const { merge } = require('webpack-merge');
const common = require('./webpack.common');

/** @type { import('webpack').Configuration } */
module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
});
