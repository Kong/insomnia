// @flow
import * as React from 'react';
import styled from 'styled-components';

const StyledRadioButtonGroup: React.ComponentType<{}> = styled.div`
  display: flex;
  justify-content: space-between;
  padding: var(--padding-xs);
  border: 1px solid var(--hl-xs);
  border-radius: var(--radius--sm);
  & > * :not(:last-child) {
    margin-right: var(--padding-xs);
  }

  label {
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
    }
  }

  input:checked + span {
    background-color: var(--hl-xs);
  }
`;

class RadioButtonGroup extends React.Component<{}> {
  render() {
    return <StyledRadioButtonGroup {...this.props} />;
  }
}

export default RadioButtonGroup;
