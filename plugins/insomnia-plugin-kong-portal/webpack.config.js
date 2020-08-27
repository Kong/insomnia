const path = require('path');

module.exports = {
  entry: { index: './index.js' },
  target: 'node',
  mode: 'production',
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: 'kongDeploy',
    libraryTarget: 'commonjs2',
  },
  // For UI plugins that require styled-components, the module should be extracted from the window object
  // via externals as defined below. This is to ensure there is only one instance of styled-components on the page.
  // Because styled-components are loaded at runtime, they don't have direct access to modules in the electron bundle
  // of the Insomnia application.
  // window['styled-components'] is set in packages/insomnia-app/app/ui/index.js
  externals: {
    'styled-components': 'window styled-components',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
};
