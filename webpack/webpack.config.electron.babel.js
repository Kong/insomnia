const path = require('path');
const productionConfig = require('./webpack.config.production.babel');

const output = {
  libraryTarget: 'commonjs2'
};

if (process.env.NODE_ENV === 'development') {
  output.path = path.join(__dirname, '../app');
  output.filename = 'main.tmp.js';
} else {
  output.path = path.join(__dirname, '../build');
  output.filename = 'main.js';
}

module.exports = {
  ...productionConfig,
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
