import React, { type FC, type InputHTMLAttributes, useCallback, useState } from 'react';
import { ListBox, ListBoxItem } from 'react-aria-components';

import { useRootLoaderData } from '~/root';
import { invariant } from '~/utils/invariant';

import type { SettingsOfType } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';

export const TextArraySetting: FC<{
  disabled?: InputHTMLAttributes<HTMLInputElement>['disabled'];
  help?: string;
  label: string;
  placeholder?: InputHTMLAttributes<HTMLInputElement>['placeholder'];
  setting: SettingsOfType<string[] | null>;
}> = ({ disabled, help, label, placeholder, setting }) => {
  const { settings } = useRootLoaderData()!;
  invariant(setting in settings, `Invalid setting name ${setting}`);

  const patchSettings = useSettingsPatcher();
  const [folderToAdd, setFolderToAdd] = useState('');

  let currentValue = settings[setting];
  if (!Array.isArray(currentValue)) {
    currentValue = [];
  }

  const onAddDataFolder = useCallback(async () => {
    const validValue = folderToAdd ? folderToAdd.trim() : '';
    const normalizedValue = validValue.replace(/\/+$/, '') || validValue;
    const exists = currentValue.some(v => (v.replace(/\/+$/, '') || v) === normalizedValue);
    if (folderToAdd !== '' && !exists) {
      const updatedValue = [...currentValue, validValue];
      patchSettings({ [setting]: updatedValue });
    }
    setFolderToAdd('');
  }, [patchSettings, setting, currentValue, folderToAdd]);

  const onDeleteDataFolder = useCallback(
    (dataFolder: string) => {
      const updatedValue = currentValue.filter(folder => folder !== dataFolder);

      patchSettings({ [setting]: updatedValue });
    },
    [currentValue, patchSettings, setting],
  );

  const trimmedInput = folderToAdd.trim();
  const normalizedInput = trimmedInput.replace(/\/+$/, '') || trimmedInput;
  const isDuplicate =
    normalizedInput.length > 0 && currentValue.some(v => (v.replace(/\/+$/, '') || v) === normalizedInput);
  const isAddDisabled = disabled || trimmedInput.length === 0 || isDuplicate;
  const addButtonTooltip = isDuplicate
    ? 'Duplicate folders are not allowed.'
    : trimmedInput.length === 0
      ? 'Enter a folder path to add.'
      : '';

  return (
    <div className="form-control form-control--outlined">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <div className="flex justify-between gap-2">
          <input
            value={folderToAdd}
            disabled={disabled}
            name={setting}
            onChange={e => {
              setFolderToAdd(e.target.value);
            }}
            placeholder={placeholder}
            type={'text'}
            data-testid={setting}
            style={isDuplicate ? { border: '1px solid var(--color-danger)' } : undefined}
          />
          <Tooltip message={addButtonTooltip} position="top" isDisabled={!addButtonTooltip}>
            <button
              className="btn btn--outlined btn--super-compact flex items-center gap-2"
              data-testid={`${setting}-btn`}
              disabled={isAddDisabled}
              style={{ cursor: isAddDisabled ? 'not-allowed' : 'pointer' }}
              onClick={onAddDataFolder}
            >
              Add
            </button>
          </Tooltip>
        </div>
        {isDuplicate && (
          <p className="margin-top-xs text-sm" style={{ color: 'var(--color-danger)' }}>
            Duplicate folders are not allowed.
          </p>
        )}
      </label>

      <ListBox aria-label="data folders" className="margin-top-sm flex w-full flex-col overflow-y-auto">
        {currentValue.map((dataFolderPath, index) => {
          const key = `${dataFolderPath}-${index}`;
          return (
            <ListBoxItem
              key={key}
              id={dataFolderPath}
              data-testid={`data-folder-${index}`}
              textValue={dataFolderPath}
              className="flex min-h-[30px] justify-between gap-2 rounded-xs px-2 py-1 outline-hidden odd:bg-(--hl-xs)"
            >
              <span className="flex min-w-[70%] items-center break-all" data-testid="cookie-domain">
                <span>{dataFolderPath || ''}</span>
              </span>
              <div className="flex min-w-[30%] items-center justify-end gap-1">
                <PromptButton
                  className="flex min-w-[15px] items-center gap-2 px-2 py-1 text-sm font-semibold text-(--color-font) transition-all aria-pressed:bg-(--hl-sm)"
                  confirmMessage=""
                  doneMessage=""
                  onClick={() => onDeleteDataFolder(dataFolderPath)}
                  title="Delete cookie"
                >
                  <i className="fa fa-trash-o" />
                </PromptButton>
              </div>
            </ListBoxItem>
          );
        })}
      </ListBox>
    </div>
  );
};
