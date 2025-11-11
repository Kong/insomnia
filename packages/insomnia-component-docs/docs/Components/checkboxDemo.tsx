import { Checkbox, CheckboxGroup } from 'insomnia/src/ui/components/base/checkbox';
import React, { useState } from 'react';

export const ControlledCheckboxDemo = () => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div>
      <Checkbox isSelected={accepted} onChange={setAccepted}>
        I agree to the terms
      </Checkbox>
      <p>Status: {accepted ? 'Accepted' : 'Not accepted'}</p>
    </div>
  );
};

export const SelectAllDemo = () => {
  const allOptions = [
    { label: 'Feature A', value: 'a' },
    { label: 'Feature B', value: 'b' },
    { label: 'Feature C', value: 'c' },
  ];

  const [selectedFeatures, setSelectedFeatures] = useState(['a']);

  const allSelected = selectedFeatures.length === allOptions.length;
  const someSelected = selectedFeatures.length > 0 && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFeatures(allOptions.map(opt => opt.value));
    } else {
      setSelectedFeatures([]);
    }
  };

  return (
    <div>
      <Checkbox isSelected={allSelected} isIndeterminate={someSelected} onChange={handleSelectAll}>
        Select All Features
      </Checkbox>

      <hr className="my-2" />

      <CheckboxGroup value={selectedFeatures} onChange={setSelectedFeatures} options={allOptions} />
    </div>
  );
};
