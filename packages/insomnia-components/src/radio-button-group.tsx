import React, { FunctionComponent, useCallback } from 'react';
import styled from 'styled-components';

export interface RadioButtonGroupProps {
  name: string;
  onChange: (value: string) => any;
  choices: {
    label: string;
    value: string;
  }[];
  className?: string;
  selectedValue: string;
}

const StyledRadioButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  padding: var(--padding-xs);
  border: 1px solid var(--hl-xs);
  border-radius: var(--radius--sm);

  & > * :not(:last-child) {
    margin-right: var(--padding-xs);
  }
`;

const StyledRadioButtonBtn = styled.label`
  cursor: pointer;
  color: var(--color-font);
  flex-grow: 1;
  justify-content: center;

  input {
    display: none;
  }

  span {
    text-align: center;
    padding: var(--padding-sm) var(--padding-xs);
    display: block;
    border-radius: var(--line-height-sm);
  }

  input:checked + span {
    background-color: var(--hl-xs);
  }
`;

export const RadioButtonGroup: FunctionComponent<RadioButtonGroupProps> = ({
  name,
  choices,
  onChange,
  className,
  selectedValue,
}) => {
  const handleChange = useCallback(e => {
    if (typeof onChange !== 'function') {
      return;
    }

    onChange(e.currentTarget.value);
  }, [onChange]);

  return (
    <StyledRadioButtonGroup className={className}>
      {choices.map(({ label, value }) => (
        <StyledRadioButtonBtn key={value}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={selectedValue === value}
            onChange={handleChange}
          />
          <span>{label}</span>
        </StyledRadioButtonBtn>
      ))}
    </StyledRadioButtonGroup>
  );
};
