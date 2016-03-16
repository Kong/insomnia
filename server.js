var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('./webpack/dev.config.js');

new WebpackDevServer(webpack(config), {
  publicPath: config.output.publicPath,
  debug: true,
  hot: true,
  stats: {
    colors: true
  },
  historyApiFallback: true
}).listen(3000, 'localhost', function (err, result) {
  if (err) {
    return console.log(err);
  }

  console.log('Listening at http://localhost:3000/');
});
