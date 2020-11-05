// @flow
import React from 'react';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';

type Method = {
  path: string,
};

type Props = {
  methods?: Array<Method>,
  selectedMethod?: Method,
};

const demoMethods = [
  '/hello.HelloService/someOtherStuff',
  '/hello.HelloService/LotsOfGreetings',
  '/hello.HelloService/aFewMore',
];

const GrpcMethodDropdown = (props: Props) => {
  // const { methods, selectedMethod } = props;

  return (
    <Dropdown>
      <DropdownButton>
        /hello.HellowService/LotsOfGreetings
        <i className="fa fa-caret-down" />
      </DropdownButton>
      {demoMethods.map(method => (
        <DropdownItem
          key={method}
          onClick={() => {
            console.log('DD Item clicked...');
          }}
          value={method}>
          {method}
        </DropdownItem>
      ))}
    </Dropdown>
  );
};

export default GrpcMethodDropdown;
