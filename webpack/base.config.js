var path = require('path');
var webpack = require('webpack');
var webpackTargetElectronRenderer = require('webpack-target-electron-renderer');

var config = {
  target: 'web',
  devtool: 'source-map',
  context: path.join(__dirname, '../app'),
  entry: [
    './index.js',
    './electron.html'
  ],
  output: {
    path: path.join(__dirname, '../dist'),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {
        id: 'babel',
        test: /\.jsx?$/,
        loaders: ['babel'],
        exclude: /node_modules/
      },
      {
        test: /\.(scss|css)$/,
        loader: 'style!css!sass'
      },
      {
        test: /\.(html)$/,
        loader: "file?name=[name].[ext]"
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
      },
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        loader: "file"
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url?limit=10000&mimetype=image/svg+xml"
      }
    ]
  },
  resolve: {
    extensions: ['', '.js', '.jsx', '.electron.js', '.chrome.js'],
    packageMains: ['webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main']
  },
  plugins: [
    new webpack.DefinePlugin({
      __DEV__: true,
      'process.env': {
        NODE_ENV: JSON.stringify('development')
      }
    }),
    new webpack.ExternalsPlugin('commonjs', [
      'request'
    ])
  ]
};

config.target = webpackTargetElectronRenderer(config);
module.exports = config;
