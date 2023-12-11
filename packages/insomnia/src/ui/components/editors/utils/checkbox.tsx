import React, { FC } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 9px;
  margin-left: 25px;
  background-color: '#fff';
`;

export const Checkbox: FC<{
  label?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <Container onClick={() => onChange(checked)}>
    {checked ? (
      <i data-testid="toggle-is-on" className="fa fa-check-square-o" />
    ) : (
      <i data-testid="toggle-is-off" className="fa fa-square-o" />
    )}
    <h3>{label}</h3>
  </Container>
);
