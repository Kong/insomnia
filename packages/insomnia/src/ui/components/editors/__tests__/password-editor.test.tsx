import { fireEvent, render } from '@testing-library/react';
import React from 'react';

import { PasswordEditor } from '../password-editor';
const props = {
  password: 'password',
  disabled: false,
};

describe('<PasswordEditor />', () => {
  it('should able to render the component', () => {
    const { getByRole, getByDisplayValue } = render(<PasswordEditor {...props} />);
    expect(getByDisplayValue('password')).toBeInTheDocument();
    expect(getByDisplayValue('password').type).toBe('password');
    expect(getByRole('button')).toBeInTheDocument();
  });

  it('should able to show password value as text and hide password-reveal icon if showAllPasswords is true', () => {
    const { getByDisplayValue, queryByRole } = render(
      <PasswordEditor password="password" showAllPasswords={true} />,
    );
    expect(getByDisplayValue('password').type).toBe('text');
    expect(queryByRole('button')).not.toBeInTheDocument();
  });

  it('should able to show password value if clicked on password-reveal icon', () => {
    const { getByRole, getByDisplayValue } = render(<PasswordEditor password="password" />);
    const passwordInput = getByDisplayValue('password');
    expect(passwordInput.type).toBe('password');
    fireEvent.click(getByRole('button'));
    expect(passwordInput.type).toBe('text');
  });
});
