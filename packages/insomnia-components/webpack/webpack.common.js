const path = require('path');

module.exports = {
  entry: {index: './index.js'},
  target: 'web',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    library: 'insomniaComponents',
    libraryTarget: 'commonjs2',
  },
  externals: ['react', 'react-dom'],
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
