const path = require('path');
const productionConfig = require('./webpack.config.production.babel');

let devtool;
const output = {
  libraryTarget: 'commonjs2',
  filename: 'main.min.js'
};

if (process.env.NODE_ENV === 'development') {
  output.path = path.join(__dirname, '../app');
  devtool = 'eval-source-map';
} else {
  output.path = path.join(__dirname, '../build');
  devtool = productionConfig.devtool;
}

module.exports = {
  ...productionConfig,
  devtool: devtool,
  entry: [
    './main.development.js'
  ],
  output: output,
  node: {
    __dirname: false,
    __filename: false
  },
  target: 'electron-main'
};
