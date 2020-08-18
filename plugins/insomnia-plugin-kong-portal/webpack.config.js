const path = require('path');

module.exports = {
  entry: { index: './index.js' },
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: 'kongDeploy',
    libraryTarget: 'commonjs2',
  },
  externals: {
    'insomnia-components': 'global insomnia-components',
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
};
