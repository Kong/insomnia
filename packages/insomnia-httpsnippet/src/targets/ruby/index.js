'use strict'

module.exports = {
  info: {
    key: 'ruby',
    title: 'Ruby',
    extname: '.rb',
    default: 'native'
  },

  native: require('./native')
}
