import path from 'path';
import productionConfig from './webpack.config.production.babel';

export default {
  ...productionConfig,
  entry: [
    './main.js'
  ],
  output: {
    path: path.join(__dirname, '../build'),
    filename: 'main.js',
    libraryTarget: 'commonjs2'
  },
  node: {
    __dirname: false,
    __filename: false
  },
  target: 'electron-main'
};
