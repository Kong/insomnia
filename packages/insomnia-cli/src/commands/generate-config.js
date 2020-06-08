import React from 'react';
import { render } from 'ink';
import { Counter } from './counter';

export default () => {
  console.log('generate');
  render(<Counter />);
};
