const webpack = require('webpack');
const { merge } = require('webpack-merge');
const base = require('./webpack.config.base');

module.exports = merge(
  base,
  /** @type { import('webpack').Configuration } */ ({
    mode: 'development',
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: true,
        'process.env.DEFAULT_APP_NAME': JSON.stringify('insomnia-app'),
      }),
    ],
  }),
);
