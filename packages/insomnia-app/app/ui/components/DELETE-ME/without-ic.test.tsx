import React from 'react';
import { render } from '@testing-library/react';
import { WithoutIc } from './without-ic';

describe('without insomnia components', () => {
    it('should render', () => {
        const { getByText } = render(<WithoutIc />);
        expect(getByText('test')).toHaveTextContent('test');
    });
});
