const { merge } = require('webpack-merge');
const common = require('./webpack.common');

/** @type { import('webpack').Configuration } */
module.exports = merge(common, ({
  mode: 'development',
  devtool: 'inline-source-map',
}));
