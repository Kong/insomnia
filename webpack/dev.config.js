var path = require('path');
var webpack = require('webpack');
var base = require('./prod.config');

base.entry = [
    'webpack-dev-server/client?http://0.0.0.0:3000',
    'webpack/hot/only-dev-server'
].concat(base.entry);

base.debug = true;
base.devtool = 'inline-source-maps';
base.output.path = path.join(base.output.path, '/dev');
base.output.publicPath = '/';

for (var i = 0; i < base.module.loaders.length; i++) {
    var loader = base.module.loaders[i];
    if (loader.id === 'babel') {
        loader.loaders = ['react-hot'].concat(loader.loaders);
        break;
    }
}

base.plugins = [new webpack.HotModuleReplacementPlugin()];

module.exports = base;

