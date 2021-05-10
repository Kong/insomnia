import React from 'react';
import { render } from '@testing-library/react';
import { WithIcWithoutSc } from './with-ic-without-sc';

describe('with insomnia components without styled components', () => {
    it('should render', () => {
        const { getByText } = render(<WithIcWithoutSc />);
        expect(getByText('test')).toHaveTextContent('test');
    });
});
