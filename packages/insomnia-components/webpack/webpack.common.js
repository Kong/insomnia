const path = require('path');
const createStyledComponentsTransformer = require('typescript-plugin-styled-components').default;
const styledComponentsTransformer = createStyledComponentsTransformer();

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
  optimization: {
    // Disable minification for now, otherwise smoke tests fail
    // Note, minification is disabled in insomnia-app as well
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: [/node_modules/],
        options: {
          configFile: 'tsconfig.build.json',
          getCustomTransformers: () => ({ before: [styledComponentsTransformer] }),
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx'],
  },
  externals: ['react', 'react-dom', 'styled-components', 'react-use'],
};
