const path = require('path');

module.exports = /** @type { import('webpack').Configuration } */ ({
  entry: { index: './src/index.ts' },
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: 'insomniatesting',
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
    extensions: ['.ts', '.js'],
  },
  externals: [
    // Don't bundle Mocha because it needs to use require() to load tests.
    // If it's bundled in the Webpack build, it will try to use Webpack's require() function and fail to import the test file because it lives outside the bundle.
    'mocha',
  ],
});
