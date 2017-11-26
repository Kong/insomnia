import webpack from 'webpack';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

let outputFile;
let devtool;
let env;
let stripePubKey;
let extraPlugins;

if (isDev) {
  outputFile = `[name].min.js`;
  devtool = 'source-map';
  env = 'development';
  stripePubKey = 'pk_test_MbOhGu5jCPvr7Jt4VC6oySdH';
  extraPlugins = [];
} else {
  outputFile = `[name].min.js`;
  devtool = 'source-map';
  env = 'production';
  stripePubKey = 'pk_live_lntbVSXY3v1RAytACIQJ5BBH';
  extraPlugins = [
    new webpack.optimize.UglifyJsPlugin({
      mangle: {
        // Don't mangle BigInteger because node-srp asserts it's type by name
        except: ['BigInteger']
      }
    })
  ];
}

export default {
  context: path.join(__dirname, './src'),
  entry: {
    app: './index.js',
    main: './main.js'
  },
  devtool,
  output: {
    path: path.resolve('./site/static/javascript/build'),
    filename: outputFile,
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    rules: [
      {
        test: /\.json$/,
        use: ['json-loader']
      },
      {
        test: /\.js$/,
        use: ['babel-loader'],
        exclude: /(node_modules|bower_components)/
      }
    ]
  },
  plugins: [
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'process.env.STRIPE_PUB_KEY': JSON.stringify(stripePubKey),
    }),
    ...extraPlugins
  ]
};
