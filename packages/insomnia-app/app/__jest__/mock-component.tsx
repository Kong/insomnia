import React, { forwardRef, ForwardRefRenderFunction } from 'react';

export const mockRenderWithProps = jest.fn();

export const MockComponentTestId = 'MockComponent';

const MockComponentWithRef: ForwardRefRenderFunction<any, any> = (props, ref) => {
  mockRenderWithProps(props);
  return <div ref={ref} data-testid={MockComponentTestId} />;
};

export const MockComponent = forwardRef(MockComponentWithRef);
