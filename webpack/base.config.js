var path = require('path');
var webpack = require('webpack');

module.exports = {
    context: path.join(__dirname, '../app'),
    entry: [
        './index.js',
        './index.html'
    ],
    output: {
        path: path.join(__dirname, '../dist'),
        filename: 'bundle.js'
    },
    module: {
        loaders: [
            {
                id: 'babel',
                test: /\.jsx?$/,
                loaders: ['babel?presets[]=react,presets[]=es2015'],
                exclude: /node_modules/
            },
            {
                test: /\.(scss|css)$/,
                loader: 'style!css!sass'
            },
            {
                test: /\.(html)$/,
                loader: "file?name=[name].[ext]"
            },
            {
                test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=application/font-woff"
            },
            {
                test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=application/font-woff"
            },
            {
                test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=application/octet-stream"
            },
            {
                test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
                loader: "file"
            },
            {
                test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
                loader: "url?limit=10000&mimetype=image/svg+xml"
            }
        ]
    },
    resolve: {
        extensions: ['', '.js', '.jsx']
    }
};