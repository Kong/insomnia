import * as React from 'react';
import { useState } from 'react';

function FilterInput(props) {
  const [filterValue, setFilterValue] = useState('');

  function handleChange(event) {
    setFilterValue(event.target.value);
    if (props.onChange) props.onChange(filterValue);
  }
  return (
    <input
      type="text"
      placeholder={props.placeholder}
      value={filterValue}
      onChange={handleChange}
    />
  );
}

export default FilterInput;
