import { Configuration, ProvidePlugin } from 'webpack';
import path from 'path';
import pkg from '../package.json';

const configuration: Configuration = {
  context: path.join(__dirname, '../send-request'),
  entry: {
    index: './index.ts',
  },
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: false,
  },
  output: {
    filename: '[name].js',
    library: 'insomniasendrequest',
    libraryTarget: 'commonjs2',

    // Export directly where we need it for now
    path: path.resolve(__dirname, '../../insomnia-send-request/dist'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: [/node_modules/],
        options: {
          configFile: 'tsconfig.build.sr.json',
        },
      },
      {
        test: require.resolve('../app/network/ca-certs.js'),
        use: [
          {
            loader: 'val-loader',
          },
        ],
      },
    ],
  },
  externals: [
    // Omit all dependencies in app/package.json (we want them loaded at runtime via NodeJS)
    ...Object.keys(pkg.dependencies).filter(name => !pkg.packedDependencies.includes(name)),
  ],
  resolve: {
    alias: {
      // Replace electron with a minimal polyfill that contains just enough to get
      // the things in this bundle working
      electron: path.resolve(path.join(__dirname, '../send-request/electron')),
    },
    extensions: ['.js', '.json', '.ts', '.tsx'],
  },
  plugins: [
    new ProvidePlugin({ window: path.resolve(path.join(__dirname, '../send-request/window-shim')) }),
  ],
};

export default configuration;
