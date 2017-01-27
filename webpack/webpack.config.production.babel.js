import webpack from 'webpack';
import baseConfig from './webpack.config.base.babel';

export default {
  ...baseConfig,
  devtool: 'source-map',
  plugins: [
    ...baseConfig.plugins,
    // NOTE: Uglification breaks everything! So many problems for some reason
    // new webpack.optimize.UglifyJsPlugin(),
    new webpack.DefinePlugin({
      __DEV__: false,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.INSOMNIA_ENV': JSON.stringify('production'),
      'process.env.HOT': JSON.stringify(null),
    })
  ]
}
