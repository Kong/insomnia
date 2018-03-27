'use strict'

module.exports = {
  info: {
    key: 'shell',
    title: 'Shell',
    extname: '.sh',
    default: 'curl'
  },

  curl: require('./curl'),
  httpie: require('./httpie'),
  wget: require('./wget')
}
