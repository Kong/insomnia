// @Flow
import styled from 'styled-components';

export default styled.span`
  /*
  padding-left: var(--padding-lg);
  */
  display: table;
  &:first-of-type {
    padding-left: var(--padding-lg);
  }
  span {
    display: table-cell;
    vertical-align: middle;
    padding: var(--padding-xxs) var(--padding-xs);
    text-transform: uppercase;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: white;
    border-radius: var(--radius-sm);
    text-shadow: 1px 1px 0px var(--hl-sm);
    transition: background-color 0.2s ease;
    margin-left: var(--padding-xs);

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
  }
`;
