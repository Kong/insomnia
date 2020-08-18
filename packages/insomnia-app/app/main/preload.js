process.once('loaded', () => {
  console.log('loaded');
  const insomniaComponents = require('styled-components');
  global['styled-components'] = insomniaComponents;
});
