const path = require('path');
const productionConfig = require('./webpack.config.production.babel');

let devtool;
const output = {
  libraryTarget: 'commonjs2'
};

if (process.env.NODE_ENV === 'development') {
  output.path = path.join(__dirname, '../app');
  output.filename = 'main.min.js';
  devtool = 'eval-source-map';
} else {
  output.path = path.join(__dirname, '../build');
  output.filename = 'main.js';
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
