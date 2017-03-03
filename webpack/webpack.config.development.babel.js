const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.babel');

const PORT = 3333;

module.exports = {
  ...baseConfig,
  devtool: 'eval-source-map',
  entry: [
    'react-hot-loader/patch',
    ...baseConfig.entry
  ],
  output: {
    ...baseConfig.output,
    publicPath: `http://localhost:${PORT}/`
  },
  devServer: {
    hot: true,
    hotOnly: true,
    noInfo: true,
    port: PORT,
    publicPath: `http://localhost:${PORT}/`
  },
  plugins: [
    ...baseConfig.plugins,
    new webpack.LoaderOptionsPlugin({debug: true}), // Legacy global loader option
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.DefinePlugin({
      __DEV__: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development')
    })
  ]
};
