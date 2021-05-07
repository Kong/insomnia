const path = require('path');

/** @type { import('webpack').Configuration } */
module.exports = {
  entry: { index: './src/index.ts' },
  target: 'web',
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].js',
    sourceMapFilename: '[name].js.map',
    library: 'insomniaComponents',
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
    extensions: ['.js', '.json', '.ts', '.tsx'],
  },
  externals: ['react', 'react-dom', 'styled-components'],
};
