const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const {parse: urlParse} = require('url');

const config = require('./webpack.config.development.babel');

const app = express();
const compiler = webpack(config);

app.use(webpackDevMiddleware(compiler, {
  publicPath: config.output.publicPath,
  noInfo: true,
  stats: {
    colors: true
  }
}));

app.use(webpackHotMiddleware(compiler));

const parsedUrl = urlParse(config.output.publicPath);
app.listen(parsedUrl.port, parsedUrl.hostname, err => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(`Listening at http://${parsedUrl.hostname}:${parsedUrl.port}`);
});
