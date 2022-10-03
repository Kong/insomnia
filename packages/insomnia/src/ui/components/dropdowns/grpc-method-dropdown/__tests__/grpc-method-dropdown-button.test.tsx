import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react';
import user from '@testing-library/user-event';
import React from 'react';

import { GrpcMethodDropdownButton } from '../grpc-method-dropdown-button';

describe('<GrpcMethodDropdownButton />', () => {
  it('should show "Select Method" when nothing is selected', () => {
    const { getByRole } = render(<GrpcMethodDropdownButton />);
    expect(getByRole('button')).toHaveTextContent('Select Method');
  });

  it('should show path if selection exists', () => {
    const { getByRole } = render(<GrpcMethodDropdownButton fullPath={'/pkg.svc/mthd'} />);
    expect(getByRole('button')).toHaveTextContent('/svc/mthd');
    user.hover(getByRole('button'));
  });

  it('should show path if selection exists and clear if method selection is removed', () => {
    const { getByRole, rerender } = render(<GrpcMethodDropdownButton fullPath={'/pkg.svc/mthd'} />);
    expect(getByRole('button')).toHaveTextContent('/svc/mthd');
    rerender(<GrpcMethodDropdownButton />);
    expect(getByRole('button')).toHaveTextContent('Select Method');
  });
});
