import path from 'path';
import { Configuration, DefinePlugin } from 'webpack';

import packageJSON from '../package.json';
import productionConfig from './webpack.config.production';

const PORT = packageJSON.dev['dev-server-port'];

let devtool: Configuration['devtool'];
let plugins: Configuration['plugins'] = [];
const output: Configuration['output'] = {
  libraryTarget: 'commonjs2',
  filename: 'main.min.js',
};

const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  output.path = path.join(__dirname, '../app');
  devtool = 'eval-source-map';
  plugins = [
    new DefinePlugin({
      'process.env.APP_RENDER_URL': JSON.stringify(`http://localhost:${PORT}/renderer.html`),
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development'),
      'process.env.RELEASE_DATE': JSON.stringify(new Date()),
    }),
  ];
} else {
  output.path = path.join(__dirname, '../build');
  devtool = productionConfig.devtool;
  plugins = productionConfig.plugins;
}

const configuration: Configuration[] = [{
  ...productionConfig,
  devtool,
  entry: ['./main.development.ts'],
  output,
  node: {
    __dirname: false, // Use node.js __dirname
  },
  target: 'electron-main',
  plugins,
},
{
  mode: isDev ? 'development' : 'production',
  devtool: isDev ? 'source-map' : false,
  entry: path.join(__dirname, '../app/preload.ts'),
  stats: 'minimal',
  target: 'electron-preload',
  output: {
    path: path.join(__dirname, '../build'),
    filename: 'preload.ts',
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
    }],
  },
}];

export default configuration;
