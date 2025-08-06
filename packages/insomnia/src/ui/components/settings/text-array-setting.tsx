import React, { type ChangeEventHandler, type FC, type InputHTMLAttributes, useCallback, useState } from 'react';
import { Button, ListBox, ListBoxItem } from 'react-aria-components';

import type { SettingsOfType } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { RenderedText } from '../rendered-text';

export const TextArraySetting: FC<{
  disabled?: InputHTMLAttributes<HTMLInputElement>['disabled'];
  help?: string;
  label: string;
  placeholder?: InputHTMLAttributes<HTMLInputElement>['placeholder'];
  setting: SettingsOfType<string[] | null>;
}> = ({ disabled, help, label, placeholder, setting }) => {
  const { settings } = useRootLoaderData();
  if (!Object.prototype.hasOwnProperty.call(settings, setting)) {
    throw new Error(`Invalid setting name ${setting}`);
  }
  const patchSettings = useSettingsPatcher();
  const [folderToAdd, setFolderToAdd] = useState("");

  let defaultValue = settings[setting];
  if (!Array.isArray(defaultValue)) {
    defaultValue = [];
  }

  const onAddDataFolder = useCallback(
    async () => {
      const validValue = folderToAdd ? folderToAdd.trim() : "";
      const exists = defaultValue.includes(validValue);
      if (folderToAdd !== "" && !exists) {
        const updatedValue = [...defaultValue, validValue];
        patchSettings({ [setting]: updatedValue });
      }
      setFolderToAdd("");
    },
    [patchSettings, setting, defaultValue, folderToAdd],
  );

  const onDeleteDataFolder = useCallback((dataFolder: string) => {
    const updatedValue = defaultValue.filter(folder => folder !== dataFolder);

    patchSettings({ [setting]: updatedValue });
  }, [defaultValue, patchSettings, setting]);

  return (
    <div className="form-control form-control--outlined">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <div className="flex justify-between gap-2">
          <input
            defaultValue={folderToAdd || ''}
            value={folderToAdd}
            disabled={disabled}
            name={setting}
            onChange={e => {
              setFolderToAdd(e.target.value);
            }}
            placeholder={placeholder}
            type={'text'}
          />
          <button
            className="btn btn--outlined btn--super-compact flex items-center gap-2"
            disabled={disabled}
            onClick={onAddDataFolder}
          >
            Add
          </button>
        </div>
      </label>

      <ListBox aria-label="data folders" className="flex w-full flex-col margin-top-sm max-h-64 overflow-y-auto">
        {defaultValue.map((dataFolderPath, index) => {
          return (
            <ListBoxItem
              key={dataFolderPath}
              id={dataFolderPath}
              data-testid={`data-folder-${index}`}
              textValue={dataFolderPath}
              className="flex min-h-[30px] justify-between gap-2 rounded-sm px-2 py-1 leading-[36px] outline-none odd:bg-[--hl-xs]"
            >
              <span className="flex min-w-[70%] items-center break-all leading-relaxed" data-testid="cookie-domain">
                <RenderedText>{dataFolderPath || ''}</RenderedText>
              </span>
              <div className="flex min-w-[30%] items-center justify-end gap-1">
                <PromptButton
                  className="flex min-w-[15px] items-center gap-2 px-2 py-1 text-sm font-semibold text-[--color-font] transition-all aria-pressed:bg-[--hl-sm]"
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
