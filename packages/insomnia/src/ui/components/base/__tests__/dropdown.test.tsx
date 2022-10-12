import { cleanup, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Dropdown, dropdownsContainerId } from '../dropdown/dropdown';
import { DropdownButton } from '../dropdown/dropdown-button';
import { DropdownItem } from '../dropdown/dropdown-item';

const prepareDom = () => {
  const dropdownsContainer = document.createElement('div');
  dropdownsContainer.setAttribute('id', dropdownsContainerId);

  dropdownsContainer.style.position = 'fixed';
  dropdownsContainer.style.right = '-90000px';
  dropdownsContainer.style.left = '-90000px';
  dropdownsContainer.style.width = '100vw';
  dropdownsContainer.style.height = '100vh';

  document.body.appendChild(dropdownsContainer);
};

describe('Dropdown', () => {
  beforeEach(() => {
    prepareDom();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render a dropdown', async () => {
    const onSelect = jest.fn();

    const options = [
      { id: 1, label: 'List of Numbers', value: [1, 2, 3] },
      { id: 2, label: 'Another List of Numbers', value: [4, 5, 6] },
      { id: 3, label: 'List of more Numbers', value: [7, 8, 9] },
    ];

    const { queryByText } = render(
      <Dropdown>
        <DropdownButton>
          Open <i className="fa fa-caret-down" />
        </DropdownButton>
        {options.map(option => (
          <DropdownItem
            key={option.id}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </DropdownItem>
        ))}
      </Dropdown>
    );

    const button = queryByText('Open');

    fireEvent.click(button);

    const option2 = queryByText(options[1].label);

    fireEvent.click(option2);

    expect(onSelect).toHaveBeenCalledWith(options[1].value);

    cleanup();
  });

  it('handle navigation via keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    const options = [
      { id: 1, label: 'List of Numbers', value: [1, 2, 3] },
      { id: 2, label: 'Another List of Numbers', value: [4, 5, 6] },
      { id: 3, label: 'List of more Numbers', value: [7, 8, 9] },
    ];

    const { queryByText, queryByTitle } = render(
      <Dropdown>
        <DropdownButton>
          Open <i className="fa fa-caret-down" />
        </DropdownButton>
        {options.map(option => (
          <DropdownItem
            key={option.id}
            title={option.label}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </DropdownItem>
        ))}
      </Dropdown>
    );

    // Click the open button
    const button = queryByText('Open');
    fireEvent.click(button);

    // Navigate with the arrows to the second option
    await user.keyboard('[ArrowDown]');
    await user.keyboard('[ArrowDown]');

    const parent = queryByTitle(options[1].label)?.parentElement;
    expect(parent).toHaveClass('active');

    // Press enter on the second option
    await user.keyboard('[Enter]');

    expect(onSelect).toHaveBeenCalledWith(options[1].value);

    // The dropdown button should regain focus
    expect(button).toHaveFocus();

  });
});
