const path = require('path');

/** @type { import('webpack').Configuration } */
module.exports = {
  entry: { index: './src/index.tsx' },
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    library: 'kongDeploy',
    filename: 'index.js',
    libraryTarget: 'commonjs2',
  },
  // For UI plugins that require styled-components, the module should be extracted from the window object via externals as defined below.
  // This is to ensure there is only one instance of styled-components on the page.
  // Because styled-components are loaded at runtime, they don't have direct access to modules in the electron bundle of the Insomnia application.
  // window['styled-components'] is set in packages/insomnia-app/app/ui/index.js
  externals: {
    'styled-components': 'window styled-components',
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
};
