import path from 'path';
import { Configuration, DefinePlugin } from 'webpack';

// import packageJSON from '../package.json';
// import productionConfig from './webpack.config.production';

// const PORT = packageJSON.dev['dev-server-port'];

// let devtool: Configuration['devtool'];
// let plugins: Configuration['plugins'] = [];
// const output: Configuration['output'] = {
//   libraryTarget: 'commonjs2',
//   filename: 'main.min.js',
// };

// if (process.env.NODE_ENV === 'development') {
//   output.path = path.join(__dirname, '../app');
//   devtool = 'eval-source-map';
//   plugins = [
//     new DefinePlugin({
//       'process.env.APP_RENDER_URL': JSON.stringify(`http://localhost:${PORT}/renderer.html`),
//       'process.env.NODE_ENV': JSON.stringify('development'),
//       'process.env.INSOMNIA_ENV': JSON.stringify('development'),
//       'process.env.BUILD_DATE': JSON.stringify(new Date()),
//     }),
//   ];
// } else {
//   output.path = path.join(__dirname, '../build');
//   plugins = productionConfig.plugins;
// }
const dev = process.env.NODE_ENV === 'development'
const configuration: Configuration[] = [{
  mode: dev ? 'development' : 'production',
  devtool: dev ? 'eval-source-map' : false,
  context: path.join(__dirname, './src'),
  entry: ['./main.ts'],
  output: {
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, './dist'),
    filename: 'main.min.js',
  },
  node: {
    __dirname: false, // Use node.js __dirname
  },
  target: 'electron-main',
  plugins: [
    new DefinePlugin({
      'process.env.APP_RENDER_URL': JSON.stringify(`http://localhost:3334/renderer.html`),
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.INSOMNIA_ENV': JSON.stringify('development'),
      'process.env.BUILD_DATE': JSON.stringify(new Date()),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
    ]
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx'],
  },
  externals: ['@getinsomnia/node-libcurl']
},
{
  stats: 'minimal',
  mode: dev ? 'development' : 'production',
  entry: './src/preload.js',
  target: 'electron-preload',
  output: {
    path: path.join(__dirname, './dist'),
    filename: 'preload.js',
  },
}];

export default configuration;
