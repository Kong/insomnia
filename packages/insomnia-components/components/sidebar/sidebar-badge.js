// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  label?: string,
  onClick?: () => void,
  method?: 'get' | 'post' | 'delete' | 'parameters' | 'patch' | 'put' | 'options-head' | string,
};

const StyledBadge: React.ComponentType<{}> = styled.span`
  display: table;
  border-spacing: var(--padding-xxs) 0;
  &:first-of-type {
    padding-left: var(--padding-lg);
  }
  margin: 0px !important;
  span {
    display: table-cell;
    vertical-align: middle;
    padding: var(--padding-xxs) var(--padding-xs);
    text-transform: uppercase;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: #fff;
    border-radius: var(--radius-sm);
    text-shadow: 1px 1px 0px var(--hl-sm);
    transition: background-color 0.2s ease;

    &.post {
      background-color: rgba(var(--color-success-rgb), 0.8);
      &:hover {
        background-color: var(--color-success);
      }
    }
    &.get {
      background-color: rgba(var(--color-surprise-rgb), 0.8);
      &:hover {
        background-color: var(--color-surprise);
      }
    }
    &.delete {
      background-color: rgba(var(--color-danger-rgb), 0.8);
      &:hover {
        background-color: var(--color-danger);
      }
    }
    &.parameters {
      display: none;
      margin-right: 0px !important;
    }
    &.options-head,
    &.custom {
      background-color: rgba(var(--color-info-rgb), 0.8);
      &:hover {
        background-color: var(--color-info);
      }
    }
    &.patch {
      background-color: rgba(var(--color-notice-rgb), 0.8);
      &:hover {
        background-color: var(--color-notice);
      }
    }
    &.put {
      background-color: rgba(var(--color-warning-rgb), 0.8);
      &:hover {
        background-color: var(--color-warning);
      }
    }
    &:hover {
      cursor: default;
    }
  }
`;

const SidebarBadge = ({ onClick = () => {}, method = 'post', label = method }: Props) => {
  return (
    <StyledBadge onClick={onClick}>
      <span className={method}>{label}</span>
    </StyledBadge>
  );
};

export default SidebarBadge;
