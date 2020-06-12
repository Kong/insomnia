// @flow
import * as React from 'react';
import styled from 'styled-components';

type Item = {
  label: string,
  selected: boolean,
};

type Props = {|
  className?: string,
  onClick: (e: SyntheticEvent<HTMLInputElement>) => any,
  optionItems: Array<Item>,
|};

const StyledSwitch: React.ComponentType<{}> = styled.div`
  margin: auto;
  .switch {
    position: relative;
    height: 34px;
    width: 140px;
    background: var(--hl-xs);
    border-radius: 17px;
  }
  .switch-label {
    position: relative;
    font-weight: bold;
    z-index: 2;
    float: left;
    width: 67px;
    line-height: 34px;
    font-size: 11px;
    color: var(--hl);
    text-align: center;
    cursor: pointer;
    padding-top: 0px;
  }
  .switch-label-off {
    padding-left: 2px;
  }
  .switch-label-on {
    padding-right: 2px;
  }
  .switch-input {
    display: none;
  }
  .switch-input:checked + .switch-label {
    color: var(--color-font);
    text-shadow: 0 1px rgba(255, 255, 255, 0.25);
  }
  .switch-input:checked + .switch-label-on ~ .switch-selection {
    left: 71px;
  }
  .switch-selection {
    position: absolute;
    z-index: 1;
    top: 4px;
    left: 4px;
    display: block;
    width: 65px;
    height: 26px;
    border-radius: 13px;
    background-color: var(--color-bg);
    transition: left 0.2s ease-out;
  }
`;

const Switch = ({ className, onClick, optionItems }: Props) => (
  <StyledSwitch className={className}>
    <div className="switch">
      {optionItems.map((item, i) => {
        return (
          <React.Fragment key={item.label}>
            <input
              type="radio"
              className="switch-input"
              name="switch"
              onClick={onClick}
              value={item.label}
              id={item.label}
              defaultChecked={item.selected ? 'defaultChecked' : ''}
            />
            <label
              htmlFor={item.label}
              className={`switch-label ${i === 0 ? 'switch-label-off' : 'switch-label-on'}`}>
              {item.label}
            </label>
          </React.Fragment>
        );
      })}
      <span className="switch-selection"></span>
    </div>
  </StyledSwitch>
);

export default Switch;
