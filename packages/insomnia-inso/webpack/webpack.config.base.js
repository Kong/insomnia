const path = require('path');
const nodeExternals = require('webpack-node-externals');

/** @type { import('webpack').Configuration } */
module.exports = {
  entry: './src/index.ts',
  target: 'node',
  stats: 'minimal',
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'index.js',
    library: 'insomniacli',
    libraryTarget: 'commonjs2',
  },
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
    extensions: ['.js', '.ts'],
  },
  externals: [
    'node-libcurl',
    'mocha',
    nodeExternals(),
  ],
};
