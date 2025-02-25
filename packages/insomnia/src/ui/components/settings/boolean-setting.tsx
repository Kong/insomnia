import React, { type FC, type ReactNode } from 'react';

import type { SettingsOfType } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { HelpTooltip } from '../help-tooltip';
import { showModal } from '../modals';
import { AskModal } from '../modals/ask-modal';

export const BooleanSetting: FC<{
  help?: string;
  label: ReactNode;
  setting: SettingsOfType<boolean>;
  confirmBeforeToggle?: boolean;
  confirmMessage?: (isChecked: boolean) => string;
  disabled?: boolean;
}> = ({
  help,
  label,
  setting,
  confirmBeforeToggle = false,
  confirmMessage,
  disabled = false,
}) => {
  const {
    settings,
  } = useRootLoaderData();
  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }
  const patchSettings = useSettingsPatcher();

  return (
    <>
      <div className="">
        <label className="flex items-center gap-2">
          <input
            checked={Boolean(settings[setting])}
            name={setting}
            onChange={event => {
              const isChecked = event.currentTarget.checked;
              if (confirmBeforeToggle) {
                const confirmMsg = typeof confirmMessage === 'function' ? confirmMessage(isChecked) : null;
                showModal(AskModal, {
                  title: `${isChecked ? 'Enable' : 'Disable'} Preference`,
                  message: confirmMsg || `Are you sure to ${isChecked ? 'enable' : 'disable'} the preference: ${label}?`,
                  onDone: async (isYes: boolean) => {
                    if (isYes) {
                      patchSettings({ [setting]: isChecked });
                    };
                  },
                });
              } else {
                patchSettings({ [setting]: isChecked });
              }
            }}
            type="checkbox"
            disabled={disabled}
          />
            {label}
            {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
          </label>
        </div>
      </>
    );
  };
