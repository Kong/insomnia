module.exports = async function({ config, mode }) {
  config.module.rules.push({
    test: /\.less$/,
    use: [
      'style-loader',
      { loader: 'css-loader', options: { importLoaders: 1 } },
      { loader: 'less-loader', options: { noIeCompat: true } },
    ],
  });

  return config;
};
