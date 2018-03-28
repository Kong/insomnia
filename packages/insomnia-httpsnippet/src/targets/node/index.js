'use strict'

module.exports = {
  info: {
    key: 'node',
    title: 'Node.js',
    extname: '.js',
    default: 'native'
  },

  native: require('./native'),
  request: require('./request'),
  unirest: require('./unirest')
}
