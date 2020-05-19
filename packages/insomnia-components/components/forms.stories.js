// @flow
import * as React from 'react';
import styled from 'styled-components';
import IndeterminateCheckbox from './helpers/indeterminate-checkbox';

export default { title: 'Form Elements | Input' };
const StyledFormRow: React.ComponentType<any> = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  align-content: center;
  flex-direction: row;

  & > * {
    width: 100%;
    margin-left: var(--padding-xxs);
    margin-right: var(--padding-xxs);
  }

  & > p {
    margin: 0;
  }

  & > *:first-child {
    margin-left: 0;
  }

  & > *:last-child {
    margin-right: 0;
  }
`;

const StyledFormControl: React.ComponentType<any> = styled.div`
  outline: none;
  border: 0;
  margin-bottom: var(--padding-sm);
  width: 100%;
  box-sizing: border-box;

  .inline-block {
    display: inline-block !important;
  }

  &.form-control--btn-right {
    position: relative;

    input {
      padding-right: 2em;
    }

    &:hover .form-control__right {
      opacity: 0.8;
    }

    .form-control__right {
      position: absolute;
      right: 0;
      top: 0;
      padding: 0 var(--padding-sm);
      height: 100%;
      display: flex;
      align-items: center;
      margin: 0;
      opacity: 0.5;

      &:hover {
        opacity: 1;
      }
    }
  }

  .input,
  input,
  textarea,
  select,
  button {
    width: 100%;
    display: block;
    margin-top: var(--padding-xs);
    box-sizing: border-box;
  }

  button,
  input[type='radio'],
  input[type='checkbox'] {
    width: auto;
  }

  input[type='radio'],
  input[type='checkbox'] {
    height: 1rem;
    float: left;
    margin-top: var(--padding-xxs);
    margin-right: var(--padding-xs);
  }

  & > button {
    width: auto;
  }

  input:invalid {
    border: 1px solid var(--color-warning) !important;
  }

  label {
    font-weight: 600;
    display: block;
    margin-top: var(--padding-xs);
    padding-top: 0;

    * {
      font-weight: normal;
    }
  }

  &.form-control--thin {
    label {
      font-weight: normal;
    }

    margin-bottom: var(--padding-xxs);
  }

  &.form-control--padded,
  &.form-control--outlined,
  &.form-control--underlined {
    textarea,
    .input,
    input,
    select {
      border: 1px solid var(--hl-md);
      padding: var(--padding-sm);
      border-radius: var(--radius-md);
      background-color: var(--hl-xxs);
    }

    // Because <select> is weird
    select {
      padding-top: 0;
      padding-bottom: 0;
    }

    &:not(.form-control--tall) {
      .input,
      input,
      select {
        height: var(--line-height-xs);
      }
    }

    .input[data-focused='on'],
    textarea:focus,
    select:focus,
    input:focus {
      background-color: transparent;
      border-color: var(--hl-lg);
    }
  }

  &.form-control--underlined .input[data-focused='on'],
  &.form-control--underlined input:focus,
  &.form-control--underlined textarea:focus {
    border-color: var(--hl);
  }

  &.form-control--padded {
    .input,
    textarea,
    select,
    input {
      border: 0;
    }
  }

  &.form-control--underlined {
    textarea,
    select,
    .input,
    input {
      border-radius: 0;
      border-top: 0;
      border-right: 0;
      border-left: 0;
      background: none;
      padding-left: var(--padding-xxs);
      padding-right: var(--padding-xxs);
    }
  }

  &.form-control--inactive {
    textarea,
    .input,
    input,
    .btn,
    select {
      border-style: dashed;
      opacity: var(--opacity-subtle);
      color: var(--hl-xl);
    }
  }

  &.form-control--wide {
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  &.form-control--no-label::before {
    content: 'nothing';
    opacity: 0;
    padding-top: var(--padding-xs);
    display: block;
  }

  &.form-row {
    display: flex;
    align-items: center;
    justify-content: center;
    align-content: center;
    flex-direction: row;

    & > * {
      width: 100%;
      margin-left: var(--padding-xxs);
      margin-right: var(--padding-xxs);
    }

    & > p {
      margin: 0;
    }

    & > *:first-child {
      margin-left: 0;
    }

    & > *:last-child {
      margin-right: 0;
    }
  }
`;

export const input = () => (
  <form>
    <StyledFormControl className="form-control--outlined">
      <input type="text" placeholder="text input" />
    </StyledFormControl>
  </form>
);

export const inputWithLabel = () => (
  <form>
    <StyledFormControl className="form-control--outlined">
      <label>
        Text Input
        <input type="text" placeholder="text input" />
      </label>
    </StyledFormControl>
  </form>
);

export const selectWithLabel = () => (
  <form>
    <StyledFormControl className="form-control--outlined">
      <label>
        Select One
        <select>
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
      </label>
    </StyledFormControl>
  </form>
);

export const checkboxWithLabel = () => (
  <form>
    <StyledFormControl className="form-control--thin">
      <label className="inline-block">
        Check Me
        <input type="checkbox" />
      </label>
    </StyledFormControl>
    <StyledFormControl className="form-control--thin">
      <label className="inline-block">
        Check Me Too!
        <input type="checkbox" />
      </label>
    </StyledFormControl>
  </form>
);

export const intermediaryCheckbox = () => (
  <form>
    <StyledFormControl className="form-control--thin">
      <label className="inline-block">
        Check me, maybe
        <IndeterminateCheckbox indeterminate={true} checked={false} />
      </label>
    </StyledFormControl>
  </form>
);

export const exampleForm = () => (
  <form className="storybook-skinny">
    <StyledFormRow>
      <StyledFormControl className="form-control--outlined">
        <label>
          First Name
          <input type="text" required placeholder="Jane" />
        </label>
      </StyledFormControl>
      <StyledFormControl className="form-control--outlined">
        <label>
          Last Name
          <input type="text" placeholder="Strong" />
        </label>
      </StyledFormControl>
    </StyledFormRow>

    <StyledFormControl className="form-control--outlined">
      <label>
        Email
        <input type="email" placeholder="text input" required />
      </label>
    </StyledFormControl>

    <StyledFormControl className="form-control--outlined">
      <label>
        Favorite Color
        <select>
          <option>Blue</option>
          <option>Pink</option>
          <option>Yellow</option>
        </select>
      </label>
    </StyledFormControl>

    <StyledFormControl className="form-control--thin">
      <label className="inline-block">
        Check me
        <input type="checkbox" />
      </label>
    </StyledFormControl>

    <StyledFormControl className="form-control--thin">
      <label className="inline-block">
        Check me too, maybe
        <IndeterminateCheckbox indeterminate={true} checked={false} />
      </label>
    </StyledFormControl>

    <StyledFormControl className="margin-top">
      <button type="submit" className="btn btn--clicky">
        Submit
      </button>
    </StyledFormControl>
  </form>
);
