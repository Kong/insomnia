import { Input } from 'insomnia/src/ui/components/base/input';
import React, { useState } from 'react';

export const SearchInputDemo = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return <Input placeholder="Search..." type="search" value={searchQuery} onChange={setSearchQuery} />;
};

export const ControlledInputDemo = () => {
  const [value, setValue] = useState('');

  return <Input label="Controlled Input" placeholder="Type something..." value={value} onChange={setValue} />;
};
