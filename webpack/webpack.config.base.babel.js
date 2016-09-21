import path from 'path';
import pkg from '../app/package.json';

export default {
  devtool: 'source-map',
  context: path.join(__dirname, '../app'),
  entry: [
    './ui/index.js',
    './main.html'
  ],
  output: {
    path: path.join(__dirname, '../build'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2'
  },
  module: {
    loaders: [
      {
        id: 'babel',
        test: /\.(js|jsx)$/,
        loaders: ['babel'],
        exclude: [/node_modules/, /backend/, /__fixtures__/, /__tests__/]
      },
      {
        test: /\.elm$/,
        exclude: [/elm-stuff/, /node_modules/],
        loader: 'elm-hot!elm-webpack'
      },
      {
        test: /\.json$/,
        loader: 'json'
      },
      {
        test: /\.(less|css)$/,
        loader: 'style!css!less'
      },
      {
        test: /\.html$/,
        loader: "file?name=[name].[ext]"
      },
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        loader: "file"
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url?limit=10000&mimetype=image/svg+xml"
      },
      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url?limit=10000&mimetype=application/font-woff"
      },
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url?limit=10000&mimetype=application/font-woff"
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url?limit=10000&mimetype=application/octet-stream"
      }
    ]
  },
  resolve: {
    alias: {
      'backend': path.resolve(__dirname, '../app/backend')
    },
    extensions: ['', '.js', '.json', '.jsx'],
    packageMains: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main']
  },
  externals: [
    // Omit all the app package.sh dependencies (we want them loaded at runtime via NodeJS)
    ...Object.keys(pkg.dependencies)
  ],
  plugins: [],
  target: 'electron-renderer'
};
