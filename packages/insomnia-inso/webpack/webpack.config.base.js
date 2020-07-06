const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: { index: './src/cli.js' },
  target: 'node',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: '[name].js',
    library: 'insomniacli',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [/node_modules/],
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  externals: [nodeExternals()],
};
