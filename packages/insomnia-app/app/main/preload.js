const insomniaComponents = require('insomnia-components');

process.once('loaded', () => {
  console.log('loaded');
  global['insomnia-components'] = insomniaComponents;
});
