const path = require('path');

module.exports = {
  entry: { index: './index.js' },
  mode: 'development',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: 'insomniaComponents',
    libraryTarget: 'commonjs2',
  },
  externals: ['react'],
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
};
