import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import GrpcMethodDropdown from '../grpc-method-dropdown';

describe('<GrpcMethodDropdown />', () => {
  it('should handle changing a proto file', () => {
    const handleChangeProtoFile = jest.fn();

    const { getByRole, queryByText } = render(
      <GrpcMethodDropdown
        methods={[]}
        handleChange={jest.fn()}
        handleChangeProtoFile={handleChangeProtoFile}
      />,
    );

    fireEvent.click(getByRole('button'));

    const changeProtoFileButton = queryByText('Click to change proto file');
    expect(changeProtoFileButton).toBeTruthy();
    fireEvent.click(changeProtoFileButton);

    expect(handleChangeProtoFile).toHaveBeenCalledTimes(1);
  });

  it('should show "No methods found" and clicking it should do nothing', () => {
    const handleChange = jest.fn();

    const { getByRole, queryByText } = render(
      <GrpcMethodDropdown
        methods={[]}
        handleChange={handleChange}
        handleChangeProtoFile={jest.fn()}
      />,
    );

    fireEvent.click(getByRole('button'));

    const nothingFound = queryByText('No methods found');
    expect(nothingFound).toBeTruthy();
    fireEvent.click(nothingFound);

    expect(handleChange).not.toHaveBeenCalled();
  });
});
