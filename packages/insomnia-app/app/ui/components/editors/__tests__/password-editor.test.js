import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import PasswordEditor from '../password-editor';

const props = {
  request: {
    authentication: {
      password: 'text-password',
    },
  },
};
describe('<PasswordEditor />', () => {
  it('should able to render the component', () => {
    const { getByRole, getByDisplayValue } = render(<PasswordEditor {...props} />);
    expect(getByDisplayValue('text-password')).toBeInTheDocument();
    expect(getByDisplayValue('text-password').type).toBe('password');
    expect(getByRole('button')).toBeInTheDocument();
  });
  it('should able to show password value as text and hide password-reveal icon if showAllPasswords is true', () => {
    const { getByDisplayValue, queryByRole } = render(
      <PasswordEditor
        request={{
          authentication: {
            password: 'text-value',
          },
        }}
        showAllPasswords={true}
      />,
    );
    expect(getByDisplayValue('text-value').type).toBe('text');
    expect(queryByRole('button')).not.toBeInTheDocument();
  });
  it('should able to show password value if clicked on password-reveal icon', () => {
    const { getByRole, getByDisplayValue } = render(
      <PasswordEditor
        request={{
          authentication: {
            password: 'text-value',
          },
        }}
      />,
    );
    const passwordInput = getByDisplayValue('text-value');
    expect(passwordInput.type).toBe('password');
    fireEvent.click(getByRole('button'));
    expect(passwordInput.type).toBe('text');
  });
});
