import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { StorageRules } from 'insomnia-api';
import { useEffect, useRef, useState } from 'react';
import { Button, Label, Radio, RadioGroup } from 'react-aria-components';

import { Icon } from '~/basic-components/icon';
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

  // Toggling between the radio list and the collapsed summary unmounts whichever
  // one currently has focus. Without deliberately moving focus, it falls to the
  // body, and an enclosing modal's FocusScope then yanks it to the first
  // focusable element (the close button). Hand focus to whichever replaces it.
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  const radioGroupContainerRef = useRef<HTMLDivElement>(null);
  const shouldFocusSummaryRef = useRef(false);
  const shouldFocusRadioRef = useRef(false);

  const handleChange = (v: string) => {
    shouldFocusSummaryRef.current = true;
    setListOpen(false);
    onChange(v);
  };

  const handleChangePressed = () => {
    shouldFocusRadioRef.current = true;
    setListOpen(true);
  };

  // Picking a type unmounts the RadioGroup; claim focus on the summary button
  // that replaces it before FocusScope's fallback grabs the modal's close button.
  useEffect(() => {
    if (shouldFocusSummaryRef.current && !listOpen && currentType) {
      shouldFocusSummaryRef.current = false;
      summaryButtonRef.current?.focus();
    }
  }, [listOpen, currentType]);

  // Clicking "Change" unmounts the summary button; claim focus on the radio
  // list that replaces it before FocusScope's fallback grabs the modal's close button.
  useEffect(() => {
    if (shouldFocusRadioRef.current && listOpen) {
      shouldFocusRadioRef.current = false;
      const checkedInput = radioGroupContainerRef.current?.querySelector<HTMLInputElement>('input:checked');
      const firstInput = radioGroupContainerRef.current?.querySelector<HTMLInputElement>('input[type="radio"]');
      (checkedInput || firstInput)?.focus();
    }
  }, [listOpen]);

  return (
    <div className="flex flex-col gap-2">
      <Label aria-label="Project Type" className="p-0 text-sm text-(--color-font)">
        Type
      </Label>
      {listOpen || !currentType ? (
        <div
          ref={radioGroupContainerRef}
          // Capture phase so we can intercept Enter before React Aria's own Radio handles it.
          onKeyDownCapture={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.target as HTMLElement).closest('form')?.requestSubmit();
            }
          }}
        >
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
                <div aria-label={`Project Type Item: ${item.type}`} className="flex gap-2 p-2">
                  <Icon icon={item.icon} className="mt-1" />
                  <div>
                    <div>{item.name}</div>
                    <div className="text-sm text-(--hl)">{item.description}</div>
                  </div>
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </div>
      ) : (
        <Button
          ref={summaryButtonRef}
          aria-label={`Project type: ${currentType.name}. Change`}
          className="flex h-[30px] w-full cursor-pointer items-center justify-between rounded-sm border border-solid border-(--hl-sm) px-2 text-(--color-font) ring-1 ring-transparent transition-colors hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset"
          onPress={handleChangePressed}
        >
          <div className="flex items-center gap-2">
            <Icon icon={currentType.icon} />
            <span>{currentType.name}</span>
          </div>
          <span>Change</span>
        </Button>
      )}
    </div>
  );
};
