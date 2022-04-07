import 'webpack-dev-server';
import packageJSON from '../package.json';
// recommended by the docs: https://webpack.js.org/configuration/configuration-languages/
// just in case you run into any typescript error when configuring `devServer`

import path from 'path';
import { Configuration, DefinePlugin, NormalModuleReplacementPlugin, optimize, LoaderOptionsPlugin } from 'webpack';

const PORT = packageJSON.dev['dev-server-port'];

const configuration: Configuration = {
  devtool: 'eval-source-map',
  mode: 'development',
  stats: 'minimal',
  context: path.join(__dirname, '../app'),
  entry: [
    `webpack-dev-server/client?http://localhost:${PORT}`,'./renderer.ts', './renderer.html',
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      {
        test: /\.(less|css)$/,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 1 } },
          { loader: 'less-loader', options: { noIeCompat: true } },
        ],
      },
      {
        test: /\.(html|woff2)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
        },
      },
      {
        test: /\.(png|svg)$/,
        loader: 'url-loader',
      },
      {
        test: require.resolve('../app/network/ca-certs.js'),
        use: [
          {
            loader: 'val-loader',
          },
        ],
      },
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
        include: [/insomnia-components/],
      },
    ],
  },
  resolve: {
    alias: {
      react: path.resolve(path.join(__dirname, '../node_modules/react')),
      'styled-components': path.resolve(path.join(__dirname, '../node_modules/styled-components')),
    },
    extensions: ['.js', '.json', '.ts', '.tsx'],
    mainFields: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
  },
  output: {
    path: path.join(__dirname, '../build'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2',
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
  target: 'electron-renderer',
  node: {
    __dirname: false, // Use Node __dirname
  },
  externals: [
    '@hapi/teamwork',
    '@getinsomnia/node-libcurl',
    '@stoplight/spectral',
    'insomnia-importers',
    'insomnia-testing',
    // To get jsonlint working...
    'file',
    'system',
  ],
  plugins: [
    new optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new DefinePlugin({
      'process.env.BUILD_DATE': JSON.stringify(new Date()),
    }),
    // see: https://github.com/Kong/insomnia/pull/3469 for why this transform is needed
    new NormalModuleReplacementPlugin(
      /node_modules\/vscode-languageserver-types\/lib\/umd\/main\.js/,
      '../esm/main.js',
    ),
    new LoaderOptionsPlugin({ debug: true }), // Legacy global loader option
    new DefinePlugin({
      __DEV__: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development'),
    }),
  ],
};

export default configuration;
