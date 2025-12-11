import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useState } from 'react';
import { Label, Radio, RadioGroup } from 'react-aria-components';

import { Icon } from '~/basic-components/icon';
import type { StorageRules } from '~/models/organization';
import type { ProjectType } from '~/ui/components/project/utils';

interface ProjectTypeItem {
  type: ProjectType;
  icon: IconProp;
  name: string;
  description: string;
  isDisabled: boolean;
}

const TypeItem = ({ icon, name, description }: Omit<ProjectTypeItem, 'type' | 'isDisabled'>) => {
  return (
    <div className="flex gap-2 p-2">
      <Icon icon={icon} className="mt-1" />
      <div>
        <div>{name}</div>
        <div className="text-sm text-(--hl)">{description}</div>
      </div>
    </div>
  );
};

interface Props {
  value?: ProjectTypeItem['type'];
  onChange: (value: string) => void;
  storageRules: StorageRules;
}
export const ProjectTypeSelect = ({ value, onChange, storageRules }: Props) => {
  const [listOpen, setListOpen] = useState(false);
  const typeList: ProjectTypeItem[] = [
    {
      type: 'local',
      icon: 'laptop',
      name: 'Local Vault',
      description: 'For working alone with data stored on your machine.',
      isDisabled: !storageRules.enableLocalVault,
    },
    {
      type: 'remote',
      icon: 'globe',
      name: 'Cloud Sync',
      description: 'Out of the box collaboration with data stored securely to the cloud.',
      isDisabled: !storageRules.enableCloudSync,
    },
    {
      type: 'git',
      icon: ['fab', 'git-alt'],
      name: 'Git Sync',
      description: 'Collaborate with others securely using your existing git provider.',
      isDisabled: !storageRules.enableGitSync,
    },
  ];

  const currentType = typeList.find(item => item.type === value);

  const handleChange = (v: string) => {
    setListOpen(false);
    onChange(v);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label aria-label="Project Type" className="p-0 text-sm text-(--color-font)">
        Type
      </Label>
      {listOpen || !currentType ? (
        <RadioGroup
          aria-label="Project Type Radio"
          className="flex flex-col px-0.5"
          value={value}
          onChange={handleChange}
        >
          <div className="rounded-sm border border-(--hl-md) p-1">
            {typeList.map(item => (
              <Radio
                key={item.name}
                value={item.type}
                isDisabled={item.isDisabled}
                className="w-full pt-0 data-disabled:cursor-not-allowed data-disabled:opacity-50"
              >
                {({ isHovered, isSelected }) => (
                  <div
                    aria-label={`Project Type: ${item.type}`}
                    className={`rounded-sm border ${isSelected ? 'border-(--color-surprise)' : 'border-transparent'} ${isHovered ? 'border-transparent bg-(--hl-xs)' : ''}`}
                  >
                    <TypeItem icon={item.icon} name={item.name} description={item.description} />
                  </div>
                )}
              </Radio>
            ))}
          </div>
        </RadioGroup>
      ) : (
        <div
          className="flex h-[30px] cursor-default items-center justify-between rounded-sm border border-(--hl-sm) px-2"
          onClick={() => setListOpen(true)}
        >
          <div>
            <Icon className="mr-2" icon={currentType?.icon} />
            {currentType?.name}
          </div>
          <div>Change</div>
        </div>
      )}
    </div>
  );
};
