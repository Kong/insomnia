import webpack from 'webpack';
import baseConfig from './webpack.config.base.babel';

const PORT = 3333;

export default {
  ...baseConfig,
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
    new webpack.LoaderOptionsPlugin({debug: true}),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      __DEV__: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development')
    })
  ]
}
