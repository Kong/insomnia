import React, { FC } from 'react';

import { getPreviewModeName, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';

interface Props {
  download: () => void;
  copyToClipboard: () => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
}

export const WebSocketPreviewModeDropdown: FC<Props> = ({
  download,
  copyToClipboard,
  previewMode,
  setPreviewMode,
}) => {
  return (
    <Dropdown
      aria-label="Websocket Preview Mode Dropdown"
      triggerButton={
        <DropdownButton className="tall">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
      }
    >
      <DropdownSection
        aria-label="Preview Mode Section"
        title="Preview Mode"
      >
        {PREVIEW_MODES.map(mode =>
          <DropdownItem
            aria-label={getPreviewModeName(mode, true)}
            key={mode}
          >
            <ItemContent
              icon={previewMode === mode ? 'check' : 'empty'}
              label={getPreviewModeName(mode, true)}
              onClick={() => setPreviewMode(mode)}
            />
          </DropdownItem>
        )}
      </DropdownSection>
      <DropdownSection
        aria-label="Actions Section"
        title="Actions"
      >
        <DropdownItem aria-label='Copy raw response'>
          <ItemContent
            icon="copy"
            label="Copy raw response"
            onClick={copyToClipboard}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export raw response'>
          <ItemContent
            icon="save"
            label="Export raw response"
            onClick={download}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
