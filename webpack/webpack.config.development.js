import webpack from 'webpack';
import baseConfig from './webpack.config.base';

export default {
  ...baseConfig,
  debug: true,
  devtool: 'inline-source-map',
  entry: [
    ...baseConfig.entry,
    'webpack-hot-middleware/client?path=http://localhost:3333/__webpack_hmr',
    'webpack/hot/only-dev-server'
  ],
  output: {
    ...baseConfig.output,
    publicPath: 'http://localhost:3333/build/'
  },
  plugins: [
    ...baseConfig.plugins,
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin(),
    new webpack.DefinePlugin({
      __DEV__: true,
      'process.env': {
        NODE_ENV: JSON.stringify('development')
      }
    })
  ]
}
