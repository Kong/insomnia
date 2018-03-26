'use strict'

module.exports = {
  info: {
    key: 'go',
    title: 'Go',
    extname: '.go',
    default: 'native'
  },

  native: require('./native')
}
