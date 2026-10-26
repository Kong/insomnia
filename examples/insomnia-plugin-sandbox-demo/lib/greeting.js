// A sibling module required by index.js — demonstrates multi-file plugins (M4). The sandbox reads
// the plugin's own files into a module map and resolves `require('./lib/greeting')` from it; the
// plugin's node_modules is never consulted.
// eslint-disable-next-line no-undef -- CJS plugin module
module.exports.greet = function (who) {
  return 'hello ' + who + ' from a required sibling file';
};
