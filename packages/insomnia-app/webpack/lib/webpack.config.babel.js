const path = require('path');

module.exports = {
  context: path.join(__dirname, '../../lib'),
  entry: {
    index: './index.js' ,
  },
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: false
  },
  output: {
    path: path.resolve(__dirname, '../../../insomnia-testing/lib'),
    filename: '[name].js',
    library: 'insomnialib',
    libraryTarget: 'commonjs2',
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
    ],
  },
  externals: [
    'insomnia-importers',
    'node-libcurl',
    'nunjucks',
    'electron',
  ],
};
