const path = require('path');
const { grep } = require('shelljs');

const root = path.resolve(__dirname, '..');
console.log('SEACHING ', root);
const result = grep('-l', 'dependencies": \\[', root + '/**/*.json');
console.log('FOUND ', result.stdout);
