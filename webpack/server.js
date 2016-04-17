'use strict';

const express = require('express');
const webpack = require('webpack');
const config = require('./dev.config.js');

const app = express();
const compiler = webpack(config);

const PORT = 3333;

app.use(require('webpack-dev-middleware')(compiler, {
  publicPath: config.output.publicPath,
  stats: {colors: true}
}));

app.use(require('webpack-hot-middleware')(compiler));

app.listen(PORT, 'localhost', err => {
  if (err) {
    console.log(err);
    return;
  }

  console.log(`Listening at http://localhost:${PORT}`);
});
