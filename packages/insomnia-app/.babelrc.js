/** @type { import('@babel/core').TransformOptions } */
module.exports = {
  presets: [
    ['@babel/preset-env',{targets: {electron: '11.2.3'}}],
    '@babel/preset-typescript',
    '@babel/preset-react',
  ],
  plugins: [
    ["@babel/plugin-proposal-nullish-coalescing-operator"],
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-private-property-in-object', { loose: true }],
    ['@babel/plugin-proposal-private-methods', { loose: true }]
  ],

}
