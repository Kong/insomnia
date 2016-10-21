import webpack from 'webpack';
import baseConfig from './webpack.config.base.babel';

const PORT = 3333;

export default {
  ...baseConfig,
  debug: true,
  devtool: 'eval-source-map',
  entry: [
    ...baseConfig.entry,
    `webpack-hot-middleware/client?path=http://localhost:${PORT}/__webpack_hmr`
  ],
  output: {
    ...baseConfig.output,
    publicPath: `http://localhost:${PORT}/build/`
  },
  plugins: [
    ...baseConfig.plugins,
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin(),
    new webpack.DefinePlugin({
      __DEV__: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development')
    })
  ]
}
