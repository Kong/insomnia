const path = require('path');
const nodeExternals = require('webpack-node-externals');

/** @type { import('webpack').Configuration } */
module.exports = {
  entry: { index: './src/index.ts' },
  target: 'node',
  mode: 'development',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: 'insomniapluginjsonpath',
    libraryTarget: 'commonjs2',
  },
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: [/node_modules/],
        options: {
          configFile: 'tsconfig.build.json',
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
