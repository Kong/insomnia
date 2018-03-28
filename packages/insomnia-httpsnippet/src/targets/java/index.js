'use strict'

module.exports = {
  info: {
    key: 'java',
    title: 'Java',
    extname: '.java',
    default: 'unirest'
  },

  okhttp: require('./okhttp'),
  unirest: require('./unirest')
}
