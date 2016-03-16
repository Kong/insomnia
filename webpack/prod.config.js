var path = require('path');
var webpack = require('webpack');
var base = require('./base.config');

base.output.path = path.join(base.output.path, '/prod');

module.exports = base;
