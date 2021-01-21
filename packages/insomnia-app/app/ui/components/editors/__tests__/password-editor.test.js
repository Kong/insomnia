import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import PasswordEditor from '../password-editor';

const props = {
  request: {
    authentication: {
      password: '',
    },
  },
};
describe('<PasswordEditor />', () => {
  it('should able to render the component', () => {
    const { getByTestId } = render(<PasswordEditor {...props} />);
    expect(getByTestId('password')).toBeInTheDocument();
    expect(getByTestId('password').type).toBe('password');
    expect(getByTestId('password-reveal')).toBeInTheDocument();
  });
  it('should able to show password value as text and hide password-reveal icon if showAllPasswords is true', () => {
    const { getByTestId, queryByTestId } = render(
      <PasswordEditor
        request={{
          authentication: {
            password: 'text-value',
          },
        }}
        showAllPasswords={true}
      />,
    );
    expect(getByTestId('password').type).toBe('text');
    expect(queryByTestId('password-reveal')).not.toBeInTheDocument();
  });
  it('should able to show password value if clicked on password-reveal icon', () => {
    const { getByTestId } = render(
      <PasswordEditor
        request={{
          authentication: {
            password: 'text-value',
          },
        }}
      />,
    );
    const passwordInput = getByTestId('password');
    expect(passwordInput.type).toBe('password');
    fireEvent.click(getByTestId('password-reveal'));
    expect(passwordInput.type).toBe('text');
  });
});
