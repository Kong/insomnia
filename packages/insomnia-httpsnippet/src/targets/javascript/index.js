'use strict';

module.exports = {
  info: {
    key: 'javascript',
    title: 'JavaScript',
    extname: '.js',
    default: 'xhr',
  },

  jquery: require('./jquery'),
  fetch: require('./fetch'),
  xhr: require('./xhr'),
};
