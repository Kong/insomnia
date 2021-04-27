const path = require('path');
const webpack = require('webpack');
const pkg = require('../package.json');

module.exports = {
  context: __dirname,
  entry: {
    index: './index.js',
  },
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
  output: {
    filename: 'index.js',
    library: 'insomniasendrequest',
    libraryTarget: 'commonjs2',

    // Export directly where we need it for now
    path: path.resolve(__dirname, '../../insomnia-send-request/dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
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
  externals: [
    // Omit all dependencies in app/package.json (we want them loaded at runtime via NodeJS)
    ...Object.keys(pkg.dependencies).filter(name => !pkg.packedDependencies.includes(name)),
  ],
  resolve: {
    alias: {
      // Replace electron with a minimal polyfill that contains just enough to get
      // the things in this bundle working
      electron: path.resolve(path.join(__dirname, './electron')),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({ window: path.resolve(path.join(__dirname, './window-shim')) }),
  ],
};
