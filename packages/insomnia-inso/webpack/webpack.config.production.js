const webpack = require('webpack');
const { merge } = require('webpack-merge');
const base = require('./webpack.config.base');

/** @type { import('webpack').Configuration } */
module.exports = merge(base, {
  mode: 'production',
  optimization: {
    minimize: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.DEFAULT_APP_NAME': JSON.stringify('Insomnia'),
      'process.env.VERSION': JSON.stringify(process.env.VERSION),
    }),
  ],
});
