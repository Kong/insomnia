import webpack from 'webpack';
import baseConfig from './webpack.config.base.babel';

export default {
  ...baseConfig,
  devtool: 'source-map',
  plugins: [
    ...baseConfig.plugins,
    new webpack.DefinePlugin({
      __DEV__: false,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.INSOMNIA_ENV': JSON.stringify('production')
    })
  ]
}
