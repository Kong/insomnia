import path from 'path';
import { Configuration, DefinePlugin, NormalModuleReplacementPlugin, optimize } from 'webpack';
const { NODE_ENV } = process.env
const dev = NODE_ENV === 'development'
console.log(`Building main for ${NODE_ENV}`)
const configuration: Configuration[] = [{
  mode: dev ? 'development' : 'production',
  devtool: dev ? 'eval-source-map' : false,
  context: path.join(__dirname, './src'),
  entry: ['./main.ts'],
  output: {
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, dev ? './bundle-dev' : '/bundle-prod'),
    filename: 'main.min.js',
  },
  node: {
    __dirname: false, // Use node.js __dirname
  },
  target: 'electron-main',
  plugins: dev
    ? [
      new DefinePlugin({
        'process.env.APP_RENDER_URL': JSON.stringify(`http://localhost:3334/renderer.html`),
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.INSOMNIA_ENV': JSON.stringify('development'),
        'process.env.BUILD_DATE': JSON.stringify(new Date()),
      }),
    ]
    : [
      new optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      new DefinePlugin({
        'process.env.BUILD_DATE': JSON.stringify(new Date()),
      }),
      // see: https://github.com/Kong/insomnia/pull/3469 for why this transform is needed
      new NormalModuleReplacementPlugin(
        /node_modules\/vscode-languageserver-types\/lib\/umd\/main\.js/,
        '../esm/main.js',
      ),
      new DefinePlugin({
        __DEV__: false,
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),],
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
    path: path.join(__dirname, dev ? './bundle-dev' : '/bundle-prod'),
    filename: 'preload.js',
  },
}];

export default configuration;
