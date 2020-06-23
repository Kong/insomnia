// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  name: string,
  defaultValue: string,
  onChange: (value: string) => any,
  choices: Array<{
    label: string,
    value: string,
  }>,
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
    padding: var(--padding-sm) var(--padding-md);
  }
`;

export default function RadioButtonGroup({ name, choices, defaultValue, onChange }: Props) {
  const handleChange = e => {
    if (typeof onChange !== 'function') {
      return;
    }

    onChange(e.currentTarget.value);
  };

  return (
    <StyledRadioButtonGroup>
      {choices.map(({ label, value }) => (
        <StyledRadioButtonBtn key={value}>
          <input
            type="radio"
            name={name}
            value={value}
            defaultChecked={defaultValue === value}
            onChange={handleChange}
          />
          <span>{label}</span>
        </StyledRadioButtonBtn>
      ))}
    </StyledRadioButtonGroup>
  );
}
