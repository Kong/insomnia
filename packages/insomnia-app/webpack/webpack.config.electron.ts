import { Configuration, DefinePlugin } from 'webpack';
import path from 'path';
import productionConfig from './webpack.config.production';
import packageJSON from '../package.json';

const PORT = packageJSON.dev['dev-server-port'];

let devtool: Configuration['devtool'];
let plugins: Configuration['plugins'] = [];
const output: Configuration['output'] = {
  libraryTarget: 'commonjs2',
  filename: 'main.min.js',
};

if (process.env.NODE_ENV === 'development') {
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

const configuration: Configuration = {
  ...productionConfig,
  devtool,
  entry: ['./main.development.ts'],
  output,
  node: {
    __dirname: false, // Use node.js __dirname
  },
  target: 'electron-main',
  plugins,
};

export default configuration;
