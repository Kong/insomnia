import { dropdownsContainerId } from '../ui/components/base/dropdown/dropdown';

export const getDropdownContainer = () => {
  const container = document.createElement('div');
  container.setAttribute('id', dropdownsContainerId);
  document.body.appendChild(container);

  return container;
};
