// @flow
import * as React from 'react';
import styled from 'styled-components';

export type Props = {
  name: string,
  onChange: (value: string) => any,
  choices: Array<{
    label: string,
    value: string,
  }>,
  className?: string,
  selectedValue: string,
};

const StyledRadioButtonGroup: React.ComponentType<{}> = styled.div`
  display: flex;
  justify-content: space-between;
  padding: var(--padding-xs);
  border: 1px solid var(--hl-xs);
  border-radius: var(--radius--sm);

  & > * :not(:last-child) {
    margin-right: var(--padding-xs);
  }
`;

const StyledRadioButtonBtn: React.ComponentType<{}> = styled.label`
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

export default function RadioButtonGroup({
  name,
  choices,
  onChange,
  className,
  selectedValue,
}: Props) {
  const handleChange = React.useCallback(
    e => {
      if (typeof onChange !== 'function') {
        return;
      }

      onChange(e.currentTarget.value);
    },
    [onChange],
  );

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
}
