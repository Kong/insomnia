import { Configuration, DefinePlugin, HotModuleReplacementPlugin, LoaderOptionsPlugin } from 'webpack';
import baseConfig from './webpack.config.base';
import packageJSON from '../package.json';

const PORT = packageJSON.dev['dev-server-port'];

const configuration: Configuration = {
  ...baseConfig,
  devtool: 'eval-source-map',
  mode: 'development',
  entry: [
    `webpack-dev-server/client?http://localhost:${PORT}`,
    'webpack/hot/only-dev-server',
    ...(Array.isArray(baseConfig.entry) ? baseConfig.entry : []),
  ],
  module: {
    ...baseConfig.module,
    rules: [
      ...(baseConfig.module?.rules || []),
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
        include: [/insomnia-components/],
      },
    ],
  },
  output: {
    ...baseConfig.output,
    publicPath: '/',
  },
  // @ts-expect-error -- TSCONVERSION I'm not convinced it's correct that for webpack v4 this isn't supposed to be here, although the types do include something similar for WebpackOptionsNormalized which is the options property of Compiler. gonna leave it here until compelled to do otherwise. we can check back later.
  devServer: {
    host: 'localhost',
    port: PORT,
    publicPath: '/',
    hot: true,
    disableHostCheck: true,

    // This is needed for source-maps to resolve correctly
    contentBase: '/',
  },
  optimization: {
    noEmitOnErrors: true,
  },
  plugins: [
    ...(baseConfig.plugins || []),
    new LoaderOptionsPlugin({ debug: true }), // Legacy global loader option
    new HotModuleReplacementPlugin(),
    new DefinePlugin({
      __DEV__: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development'),
    }),
  ],
};

export default configuration;
