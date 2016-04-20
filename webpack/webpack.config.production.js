import * as base from './webpack.config.base'

base.plugins = base.plugins.concat([
  new webpack.DefinePlugin({
    __DEV__: false,
    'process.env': {
      NODE_ENV: JSON.stringify('production')
    }
  })
]);

module.exports = base;
