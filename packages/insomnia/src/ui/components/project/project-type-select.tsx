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
          className="flex flex-col rounded-sm border border-(--hl-md) p-1"
          value={value}
          onChange={handleChange}
        >
          {typeList.map(item => (
            <Radio
              onClick={() => setListOpen(false)}
              key={item.name}
              value={item.type}
              isDisabled={item.isDisabled}
              aria-label={`Project Type: ${item.type}`}
              className="w-full rounded-sm border border-transparent pt-0 transition-colors hover:border-transparent hover:bg-(--hl-xs) data-disabled:cursor-not-allowed data-disabled:opacity-50 data-selected:border-(--color-surprise)"
            >
              <div className="flex gap-2 p-2">
                <Icon icon={item.icon} className="mt-1" />
                <div>
                  <div>{item.name}</div>
                  <div className="text-sm text-(--hl)">{item.description}</div>
                </div>
              </div>
            </Radio>
          ))}
        </RadioGroup>
      ) : (
        <div
          className="flex h-[30px] cursor-pointer items-center justify-between rounded-sm border border-(--hl-sm) px-2"
          onClick={() => setListOpen(true)}
        >
          <div className="flex items-center gap-2">
            <Icon icon={currentType?.icon} />
            <span>{currentType?.name}</span>
          </div>
          <span>Change</span>
        </div>
      )}
    </div>
  );
};
