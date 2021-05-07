import React from 'react';
import { render } from '@testing-library/react';
import { WithIc } from './with-ic';

describe('with insomnia components', () => {
    it('should render', () => {
        const { getByText } = render(<WithIc />);
        expect(getByText('test')).toHaveTextContent('test');
    });
});
