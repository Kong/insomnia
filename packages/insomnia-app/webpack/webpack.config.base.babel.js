const webpack = require('webpack');
const path = require('path');
const pkg = require('../package.json');

if (!process.env.APP_ID) {
  console.log('APP_ID environment variable must be set for webpack build!\n');
  process.exit(1);
}

module.exports = {
  devtool: 'source-map',
  context: path.join(__dirname, '../app'),
  entry: ['./renderer.js', './renderer.html'],
  output: {
    path: path.join(__dirname, '../build'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.(js)$/,
        use: ['babel-loader'],
        exclude: [/node_modules/, /__fixtures__/, /__tests__/],
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
    ],
  },
  resolve: {
    alias: {
      // Create aliases for react-hot-loader
      // https://github.com/gaearon/react-hot-loader/tree/92961be0b44260d3d3f1b8864aa699766572a67c#linking
      'react-hot-loader': path.resolve(path.join(__dirname, '../node_modules/react-hot-loader')),
      'react': path.resolve(path.join(__dirname, '../node_modules/react')),
      'react-dom': path.resolve(path.join(__dirname, '../node_modules/@hot-loader/react-dom')),
    },
    extensions: ['.js', '.json'],
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
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new webpack.DefinePlugin({
      'process.env.APP_ID': JSON.stringify(process.env.APP_ID),
      'process.env.RELEASE_DATE': JSON.stringify(new Date()),
    }),
  ],
  target: 'electron-renderer',
};
