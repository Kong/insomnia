'use strict'

module.exports = {
  info: {
    key: 'php',
    title: 'PHP',
    extname: '.php',
    default: 'curl'
  },

  curl: require('./curl'),
  http1: require('./http1'),
  http2: require('./http2')
}
