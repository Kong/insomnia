const styled = require('styled-components');

process.once('loaded', () => {
  global['styled-components'] = styled;
});
