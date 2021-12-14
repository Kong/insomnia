// recommended by the docs: https://webpack.js.org/configuration/configuration-languages/
// just in case you run into any typescript error when configuring `devServer`
import 'webpack-dev-server';

import path from 'path';
import { Configuration, DefinePlugin, NormalModuleReplacementPlugin, optimize } from 'webpack';

import pkg from '../package.json';

const configuration: Configuration = {
  devtool: 'source-map',
  stats: 'minimal',
  context: path.join(__dirname, '../app'),
  entry: ['./renderer.ts', './renderer.html'],
  output: {
    path: path.join(__dirname, '../build'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2',
  },
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
    ],
  },
  resolve: {
    alias: {
      // Create aliases for react-hot-loader
      // https://github.com/gaearon/react-hot-loader/tree/92961be0b44260d3d3f1b8864aa699766572a67c#linking
      'react-hot-loader': path.resolve(path.join(__dirname, '../node_modules/react-hot-loader')),
      react: path.resolve(path.join(__dirname, '../node_modules/react')),
      'styled-components': path.resolve(path.join(__dirname, '../node_modules/styled-components')),
      'react-dom': path.resolve(path.join(__dirname, '../node_modules/@hot-loader/react-dom')),
    },
    extensions: ['.js', '.json', '.ts', '.tsx'],
    mainFields: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main'],
  },
  node: {
    __dirname: false, // Use Node __dirname
  },
  externals: [
    // Omit all dependencies in app/package.json (we want them loaded at runtime via NodeJS)
    ...Object.keys(pkg.dependencies).filter(name => !pkg.packedDependencies.includes(name)),

    // To get jsonlint working...
    'file',
    'system',
  ],
  plugins: [
    new optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new DefinePlugin({
      'process.env.RELEASE_DATE': JSON.stringify(new Date()),
    }),
    // see: https://github.com/Kong/insomnia/pull/3469 for why this transform is needed
    new NormalModuleReplacementPlugin(
      /node_modules\/vscode-languageserver-types\/lib\/umd\/main\.js/,
      '../esm/main.js',
    ),
  ],
  target: 'electron-renderer',
};

export default configuration;
