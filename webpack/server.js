import express from 'express';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import {parse as urlParse} from 'url';

import config from './webpack.config.development.babel';

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
