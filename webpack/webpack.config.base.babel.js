import path from 'path';
import * as pkg from '../app/package.json';

export default {
  devtool: 'source-map',
  context: path.join(__dirname, '../app'),
  entry: [
    './renderer.js',
    './renderer.html'
  ],
  output: {
    path: path.join(__dirname, '../build'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: [/node_modules/, /__fixtures__/, /__tests__/],
      },
      {
        test: /\.(less|css)$/,
        use: [
          'style-loader',
          {loader: 'css-loader', options: {importLoaders: 1}},
          {loader: 'less-loader', options: {noIeCompat: true}},
        ],
      },
      {
        test: /\.(html|png|woff2)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.json'],
    mainFields: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main']
  },
  externals: [
    // Omit all dependencies in app/package.json (we want them loaded at runtime via NodeJS)
    ...Object.keys(pkg.dependencies),

    // To get jsonlint working...
    'file', 'system',
  ],
  plugins: [],
  target: 'electron-renderer'
};
