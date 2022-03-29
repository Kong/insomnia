import { render } from '@testing-library/react';
import React from 'react';

import { GrpcMethodDropdownButton } from '../grpc-method-dropdown-button';

describe('<GrpcMethodDropdownButton />', () => {
  it('should show "Select Method" when nothing is selected', () => {
    const { getByRole, queryByRole } = render(<GrpcMethodDropdownButton />);
    expect(getByRole('button')).toHaveTextContent('Select Method');
    expect(queryByRole('tooltip')).toBeNull();
  });

  it('should show path if selection exists', () => {
    const { getByRole } = render(<GrpcMethodDropdownButton fullPath={'/pkg.svc/mthd'} />);
    expect(getByRole('button')).toHaveTextContent('/svc/mthd');
    expect(getByRole('tooltip', { hidden: true })).toHaveTextContent('/pkg.svc/mthd');
  });

  it('should show path if selection exists and clear if method selection is removed', () => {
    const { getByRole, rerender } = render(<GrpcMethodDropdownButton fullPath={'/pkg.svc/mthd'} />);
    expect(getByRole('button')).toHaveTextContent('/svc/mthd');
    rerender(<GrpcMethodDropdownButton />);
    expect(getByRole('button')).toHaveTextContent('Select Method');
  });
});
