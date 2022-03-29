import { createBuilder } from '@develohpanda/fluent-builder';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';

import { grpcMethodDefinitionSchema } from '../../../../context/grpc/__schemas__';
import { GrpcMethodDropdown } from '../grpc-method-dropdown';

const builder = createBuilder(grpcMethodDefinitionSchema);

describe('<GrpcMethodDropdown />', () => {
  beforeEach(() => {
    builder.reset();
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

    // Open dropdown
    fireEvent.click(getByRole('button'));
    const nothingFound = queryByText('No methods found');
    expect(nothingFound).toBeTruthy();
    fireEvent.click(nothingFound);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('should allow you to change a proto file when no methods exist', () => {
    const handleChangeProtoFile = jest.fn();
    const { getByRole, queryByText } = render(
      <GrpcMethodDropdown
        methods={[]}
        handleChange={jest.fn()}
        handleChangeProtoFile={handleChangeProtoFile}
      />,
    );

    // Open dropdown
    fireEvent.click(getByRole('button'));
    const clickToChange = queryByText('Click to change proto file');
    expect(clickToChange).toBeTruthy();
    fireEvent.click(clickToChange);
    expect(handleChangeProtoFile).toHaveBeenCalledTimes(1);
  });

  it('should allow you to change a proto file when methods exist', () => {
    const handleChangeProtoFile = jest.fn();
    const { getByRole, getByText } = render(
      <GrpcMethodDropdown
        methods={[builder.build()]}
        handleChange={jest.fn()}
        handleChangeProtoFile={handleChangeProtoFile}
      />,
    );

    // Open dropdown
    fireEvent.click(getByRole('button'));
    fireEvent.click(getByText('Click to change proto file'));
    expect(handleChangeProtoFile).toHaveBeenCalledTimes(1);
  });

  it('should send selected method path to handle change', () => {
    const handleChange = jest.fn();
    const method = builder.path('/service/method').build();
    const { getByRole, queryAllByText } = render(
      <GrpcMethodDropdown
        methods={[method]}
        handleChange={handleChange}
        handleChangeProtoFile={jest.fn()}
      />,
    );

    // Open dropdown
    fireEvent.click(getByRole('button'));
    // Should find two items - a dropdown item and a tooltip with the same text
    const [dropdownButton, tooltip] = queryAllByText(method.path);
    expect(tooltip).toBeTruthy();
    expect(tooltip).toHaveAttribute('role', 'tooltip');
    expect(tooltip).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(dropdownButton);
    expect(handleChange).toHaveBeenCalledWith(method.path, expect.anything());
  });

  it('should create a divider with the package name', () => {
    const handleChange = jest.fn();
    const method = builder.path('/package.service/method').build();
    const { getByRole, queryByText, getByText } = render(
      <GrpcMethodDropdown
        methods={[method]}
        handleChange={handleChange}
        handleChangeProtoFile={jest.fn()}
      />,
    );

    // Open dropdown
    fireEvent.click(getByRole('button'));
    expect(queryByText('pkg: package')).toBeTruthy();
    fireEvent.click(getByText('/service/method'));
    expect(handleChange).toHaveBeenCalledWith(method.path, expect.anything());
  });
});
